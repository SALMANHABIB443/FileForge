import { spawn } from 'node:child_process'
import fsp from 'node:fs/promises'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const builds = {
  main: path.join(root, 'out', 'main', 'main.js'),
  renderer: path.join(root, 'out', 'renderer', 'index.html'),
}
for (const [label, file] of Object.entries(builds)) {
  if (!fs.existsSync(file)) {
    console.error(`Missing build artifact ${label}: ${file}\nRun "npm run build:electron" first.`)
    process.exit(2)
  }
}

const electronBin = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
if (!fs.existsSync(electronBin)) {
  console.error(`Electron binary not found: ${electronBin}`)
  process.exit(2)
}

const results = []
let failures = 0

function report(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures++
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`)
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.nextId = 0
    this.pending = new Map()
    ws.addEventListener('message', (event) => this.onMessage(event))
  }
  onMessage(event) {
    const msg = JSON.parse(event.data)
    if (!msg.id) return
    const p = this.pending.get(msg.id)
    if (!p) return
    this.pending.delete(msg.id)
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)))
    else p.resolve(msg.result)
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    })
    if (res.exceptionDetails) {
      const detail = res.exceptionDetails.exception?.description || res.exceptionDetails.text
      throw new Error(detail)
    }
    return res.result.value
  }
}

async function main() {
  const fixturesDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ff12-verify-'))
  let electron

  try {
    const helloPath = path.join(fixturesDir, 'hello.txt')
    await fsp.writeFile(helloPath, 'fileforge phase 12 verify')

    const zip = new JSZip()
    zip.file('a.txt', 'alpha')
    zip.file('b.txt', 'beta')
    const archPath = path.join(fixturesDir, 'arch.zip')
    await fsp.writeFile(archPath, await zip.generateAsync({ type: 'nodebuffer' }))

    console.log('Launching Electron with remote debugging…')
    electron = spawn(electronBin, [builds.main, '--remote-debugging-port=0'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stderrBuffer = ''
    electron.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString()
    })

    const devtoolsMatch = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`DevTools endpoint not detected within 30s\n${stderrBuffer.slice(0, 1000)}`)), 30000)
      const interval = setInterval(() => {
        const match = stderrBuffer.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)
        if (match) {
          clearTimeout(timer)
          clearInterval(interval)
          resolve(parseInt(match[1], 10))
        }
      }, 200)
    })

    let targets = []
    const deadline = Date.now() + 20000
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${devtoolsMatch}/json/list`)
        targets = await res.json()
        if (targets.some((t) => t.type === 'page' && t.webSocketDebuggerUrl)) break
      } catch {
        // not yet ready
      }
      await new Promise((r) => setTimeout(r, 250))
    }
    const pageTargets = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)
    if (pageTargets.length === 0) throw new Error('No page target available over CDP')

    let cdp
    for (const target of pageTargets) {
      const ws = new WebSocket(target.webSocketDebuggerUrl)
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve)
        ws.addEventListener('error', () => reject(new Error('WebSocket connect failed')))
      })
      const candidate = new CDP(ws)
      await candidate.send('Runtime.enable')
      let ready = false
      const readyDeadline = Date.now() + 15000
      while (Date.now() < readyDeadline) {
        try {
          if (await candidate.evaluate('typeof window.fileforge === "object" && window.fileforge !== null')) {
            ready = true
            break
          }
        } catch {
          // target not ready yet
        }
        await new Promise((r) => setTimeout(r, 200))
      }
      if (ready) {
        cdp = candidate
        break
      }
      ws.close()
    }
    if (!cdp) throw new Error('No renderer target exposed window.fileforge')

    const bridgeKeys = await cdp.evaluate(
      'Object.keys(window.fileforge).sort().join(",")',
    )
    report(
      'bridge exposes shell notification APIs',
      bridgeKeys.includes('openFile') && bridgeKeys.includes('showItemInFolder') && bridgeKeys.includes('notify'),
      bridgeKeys,
    )

    const tempDir = await cdp.evaluate('window.fileforge.getTempDir()')
    report('getTempDir returns a path', typeof tempDir === 'string' && tempDir.length > 0, tempDir)

    const tmp = (name) => path.join(tempDir, name)

    // --- Overwrite protection: autorename in temp dir (no approved input folder yet) ---
    const collisionExpr = `
      (async () => {
        const fg = window.fileforge;
        const bytes = Uint8Array.of(1, 2, 3, 4).buffer;
        await fg.writeFile({ path: ${JSON.stringify(tmp('collide.txt'))}, data: bytes });
        const first = await fg.saveOutput({ data: bytes, suggestedName: 'collide.txt', overwriteMode: 'autorename' });
        const second = await fg.saveOutput({ data: bytes, suggestedName: 'collide.txt', overwriteMode: 'autorename' });
        return { first, second };
      })()
    `
    const collision = await cdp.evaluate(collisionExpr)
    report(
      'autorename saves with (1), (2) suffixes on collision',
      collision.first && collision.second &&
        /collide \(1\)\.txt$/.test(collision.first.path) &&
        /collide \(2\)\.txt$/.test(collision.second.path),
      `${path.basename(collision.first.path)}, ${path.basename(collision.second.path)}`,
    )

    const invalidModeExpr = `
      (async () => {
        const fg = window.fileforge;
        const bytes = Uint8Array.of(9, 9, 9).buffer;
        const saved = await fg.saveOutput({ data: bytes, suggestedName: 'mode-fallback.txt', overwriteMode: 'bogus' });
        return saved && saved.path;
      })()
    `
    const fallbackPath = await cdp.evaluate(invalidModeExpr)
    report(
      'unknown overwrite mode falls back to autorename',
      typeof fallbackPath === 'string' && /mode-fallback(?: \(1\))?\.txt$/.test(path.basename(fallbackPath)),
      path.basename(fallbackPath),
    )

    const confirmNoCollisionExpr = `
      (async () => {
        const fg = window.fileforge;
        const bytes = Uint8Array.of(5, 6, 7).buffer;
        const saved = await fg.saveOutput({ data: bytes, suggestedName: 'confirm-fresh.txt', overwriteMode: 'confirm' });
        return saved && saved.path;
      })()
    `
    const confirmPath = await cdp.evaluate(confirmNoCollisionExpr)
    report(
      'confirm mode saves without prompt when no collision',
      confirmPath === tmp('confirm-fresh.txt'),
      path.basename(confirmPath),
    )

    const saveOutputFileExpr = `
      (async () => {
        const fg = window.fileforge;
        const bytes = Uint8Array.of(7, 7, 7).buffer;
        await fg.writeFile({ path: ${JSON.stringify(tmp('source.txt'))}, data: bytes });
        const first = await fg.saveOutputFile({ sourcePath: ${JSON.stringify(tmp('source.txt'))}, suggestedName: 'out.txt' });
        const second = await fg.saveOutputFile({ sourcePath: ${JSON.stringify(tmp('source.txt'))}, suggestedName: 'out.txt' });
        return { first: first && first.path, second: second && second.path };
      })()
    `
    const outFile = await cdp.evaluate(saveOutputFileExpr)
    report(
      'saveOutputFile also auto-renames on collision',
      /out\.txt$/.test(outFile.first) && /out \(1\)\.txt$/.test(outFile.second),
      `${path.basename(outFile.first)}, ${path.basename(outFile.second)}`,
    )

    // --- Windows notifications ---
    const notifyResult = await cdp.evaluate(`(async () => {
      const fg = window.fileforge;
      const res = await fg.notify({ title: 'FileForge', body: 'Phase 12 verify' });
      return res;
    })()`)
    report(
      'notify shows a Windows toast',
      notifyResult && notifyResult.ok === true,
      `supported=${notifyResult && notifyResult.supported}`,
    )

    let notifyRejected = false
    try {
      await cdp.evaluate(`window.fileforge.notify({ title: '', body: 'x' })`)
    } catch {
      notifyRejected = true
    }
    report('notify rejects invalid payloads', notifyRejected)

    // --- Open output actions (end-to-end) ---
    await cdp.evaluate(`window.fileforge.approvePaths(${JSON.stringify([helloPath, archPath])})`)

    const engineExpr = `
      (async () => {
        const fg = window.fileforge;
        const data = await fg.readFile(${JSON.stringify(helloPath)});
        const file = { path: ${JSON.stringify(helloPath)}, name: 'hello.txt', size: data.byteLength };
        const req = { requestId: 'f12-zip', kind: 'zip.create', files: [file], options: { level: 6 } };
        const res = await fg.runEngine(req);
        if (res.kind !== 'file') return { error: 'expected file result' };
        const saved = await fg.saveOutputFile({ sourcePath: res.outputPath, suggestedName: 'verify-' + res.filename });
        const opened = await fg.openFile(saved.path);
        const folder = await fg.showItemInFolder(saved.path);
        try { await fg.cleanupJobTemp(req.requestId); } catch {}
        return { saved: saved && saved.path, location: saved && saved.location, opened, folder };
      })()
    `
    const engine = await cdp.evaluate(engineExpr)
    const openOk = engine.opened && engine.opened.ok === true && engine.folder && engine.folder.ok === true
    report(
      'engine → save → Open File / Open Folder works',
      openOk && engine.saved && /\.zip$/.test(engine.saved),
      `saved=${engine.location} opened=${JSON.stringify(engine.opened)} folder=${JSON.stringify(engine.folder)}`,
    )
    if (engine.saved) {
      report('opened file exists on disk', fs.existsSync(engine.saved), engine.saved)
    }

    const missingOpen = await cdp.evaluate(`window.fileforge.openFile(${JSON.stringify(path.join(fixturesDir, 'nope.txt'))})`)
    report(
      'openFile reports failure for missing files',
      missingOpen && missingOpen.ok === false,
      missingOpen && missingOpen.error,
    )

    cdp.ws.close()
  } finally {
    if (electron && electron.exitCode === null) {
      electron.kill()
    }
    await fsp.rm(fixturesDir, { recursive: true, force: true })
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Verification complete: ${results.filter((r) => r.ok).length}/${results.length} passed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\nVerification error:', err.message)
  process.exit(1)
})