import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

for (const [label, file] of Object.entries({
  main: path.join(root, 'out', 'main', 'main.js'),
  renderer: path.join(root, 'out', 'renderer', 'index.html'),
})) {
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

async function launch(env = {}) {
  const child = spawn(electronBin, [path.join(root, 'out', 'main', 'main.js'), '--remote-debugging-port=0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, ...env },
  })
  let stderrBuffer = ''
  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString()
  })

  const devtoolsMatch = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`DevTools endpoint not detected within 30s\n${stderrBuffer.slice(0, 1000)}`)),
      30000,
    )
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
  return { child, cdp }
}

async function close(child, cdp) {
  try {
    cdp.ws.close()
  } catch {
    // ignore
  }
  if (child.exitCode === null) child.kill()
}

async function main() {
  // --- Launch 1: mock updater driver, full happy-path flow ---
  let launched
  try {
    launched = await launch({ FILEFORGE_UPDATER_MOCK: '1' })
    const { cdp } = launched

    const bridgeKeys = await cdp.evaluate('Object.keys(window.fileforge).sort().join(",")')
    report(
      'bridge exposes update APIs',
      ['checkForUpdates', 'downloadUpdate', 'installAndRestart', 'onUpdateStatus'].every((k) => bridgeKeys.includes(k)),
      bridgeKeys,
    )

    const flow = await cdp.evaluate(`(async () => {
      const statuses = []
      const off = window.fileforge.onUpdateStatus((s) => statuses.push(s))
      await window.fileforge.checkForUpdates()
      await window.fileforge.downloadUpdate()
      const deadline = Date.now() + 15000
      while (Date.now() < deadline) {
        const last = statuses[statuses.length - 1]
        if (last && last.type === 'downloaded') break
        await new Promise((r) => setTimeout(r, 50))
      }
      off()
      const available = statuses.find((s) => s.type === 'available') || null
      const seq = []
      for (const s of statuses) {
        if (seq[seq.length - 1] !== s.type) seq.push(s.type)
      }
      return {
        seq,
        available,
        last: statuses[statuses.length - 1] || null,
        progress: statuses.filter((s) => s.type === 'downloading').map((s) => s.percent),
      }
    })()`)

    report(
      'check streams checking → available → downloaded',
      flow.seq.join(',') === 'checking,available,downloading,downloaded',
      flow.seq.join(','),
    )
    report(
      'available announces version 9.9.9 with release notes',
      flow.available && flow.available.version === '9.9.9' && typeof flow.available.releaseNotes === 'string' && flow.available.releaseNotes.length > 0,
      flow.available ? `${flow.available.version} notes=${Boolean(flow.available.releaseNotes)}` : 'none',
    )
    report(
      'download reports progress before finishing',
      Array.isArray(flow.progress) && flow.progress.length > 0 && flow.progress[flow.progress.length - 1] === 100,
      flow.progress.join(','),
    )
    report(
      'downloaded reports the version that will be installed',
      flow.last && flow.last.type === 'downloaded' && flow.last.version === '9.9.9',
      flow.last && JSON.stringify(flow.last),
    )

    const noArgs = await (async () => {
      try {
        await cdp.evaluate('window.fileforge.invoke("update:check", "extra")')
        return false
      } catch {
        return true
      }
    })()
    report('update channels reject unexpected arguments', noArgs)
  } finally {
    if (launched) await close(launched.child, launched.cdp)
  }

  // --- Launch 2: no mock flag (unpackaged dev build) → dev short-circuit ---
  let devLaunch
  try {
    devLaunch = await launch({})
    const dev = await devLaunch.cdp.evaluate(`(async () => {
      const statuses = []
      const off = window.fileforge.onUpdateStatus((s) => statuses.push(s))
      await window.fileforge.checkForUpdates()
      const deadline = Date.now() + 5000
      while (Date.now() < deadline && statuses.length === 0) {
        await new Promise((r) => setTimeout(r, 50))
      }
      off()
      return statuses[0] || null
    })()`)
    report(
      'unpackaged builds short-circuit to dev status',
      dev && dev.type === 'dev',
      dev && JSON.stringify(dev),
    )
  } finally {
    if (devLaunch) await close(devLaunch.child, devLaunch.cdp)
  }

  // --- Launch 3: mock driver that fails during check → error status ---
  let errLaunch
  try {
    errLaunch = await launch({ FILEFORGE_UPDATER_MOCK: '1', FILEFORGE_UPDATER_MOCK_ERR: 'check' })
    const error = await errLaunch.cdp.evaluate(`(async () => {
      const statuses = []
      const off = window.fileforge.onUpdateStatus((s) => statuses.push(s))
      await window.fileforge.checkForUpdates()
      const deadline = Date.now() + 10000
      while (Date.now() < deadline) {
        const last = statuses[statuses.length - 1]
        if (last && last.type === 'error') break
        await new Promise((r) => setTimeout(r, 50))
      }
      off()
      return statuses[statuses.length - 1] || null
    })()`)
    report(
      'failed checks surface an error status with a message',
      error && error.type === 'error' && typeof error.message === 'string' && error.message.length > 0,
      error && JSON.stringify(error),
    )
  } finally {
    if (errLaunch) await close(errLaunch.child, errLaunch.cdp)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Verification complete: ${results.filter((r) => r.ok).length}/${results.length} passed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\nVerification error:', err.message)
  process.exit(1)
})