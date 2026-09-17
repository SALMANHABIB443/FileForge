import { spawn } from 'node:child_process'
import fsp from 'node:fs/promises'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Reads the first bytes of a file, retrying briefly in case the writer is still closing it. */
async function readHeadWithRetry(filePath) {
  if (!filePath) return null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const buf = await fsp.readFile(filePath)
      return Array.from(buf.subarray(0, 8))
    } catch {
      await sleep(200)
    }
  }
  return null
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.nextId = 0
    this.pending = new Map()
    this.ready = Promise.resolve()
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
    await sleep(250)
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
    if (await waitForBridge(candidate)) {
      cdp = candidate
      break
    }
    ws.close()
  }
  if (!cdp) throw new Error('No renderer target exposed window.fileforge')
  return { child, cdp }
}

async function waitForBridge(cdp, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      if (await cdp.evaluate('typeof window.fileforge === "object" && window.fileforge !== null')) {
        return true
      }
    } catch {
      // target not ready yet
    }
    await sleep(200)
  }
  return false
}

async function waitFor(cdp, expr, label, timeout = 20000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      if (await cdp.evaluate(expr)) return true
    } catch {
      // keep polling
    }
    await sleep(60)
  }
  throw new Error(`timed out (${timeout}ms) waiting for: ${label}\nexpr: ${expr}`)
}

async function close(child, cdp) {
  try {
    cdp.ws.close()
  } catch {
    // ignore
  }
  if (child.exitCode === null) child.kill()
}

// ---- fixture generation ----

function blockyPng(width, height, seed = 1) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  let state = seed || 1
  const rnd = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
  for (let y = 0; y < height; y += 64) {
    for (let x = 0; x < width; x += 64) {
      const g = 8 + Math.floor(rnd() * 220)
      ctx.fillStyle = `rgb(${g},${Math.floor(rnd() * 255)},${Math.floor(rnd() * 255)})`
      ctx.fillRect(x, y, 64, 64)
    }
  }
  return canvas.toBuffer('image/png')
}

async function generateFixtures(dir) {
  const write = async (name, data) => {
    const filePath = path.join(dir, name)
    await fsp.writeFile(filePath, data)
    const stat = await fsp.stat(filePath)
    return { path: filePath, name, size: stat.size }
  }

  const pdfA = await PDFDocument.create()
  pdfA.addPage([300, 200])
  const pdfB = await PDFDocument.create()
  pdfB.addPage([300, 200])
  pdfB.addPage([300, 200])

  return {
    input: await write('input.png', blockyPng(900, 700, 7)),
    input2: await write('input2.png', blockyPng(640, 480, 13)),
    slow: await write('slow.png', blockyPng(3200, 3200, 11)),
    txtA: await write('a.txt', Buffer.from('content a for zip fixture')),
    txtB: await write('b.txt', Buffer.from('content b for zip fixture')),
    pdfA: await write('doc-a.pdf', Buffer.from(await pdfA.save())),
    pdfB: await write('doc-b.pdf', Buffer.from(await pdfB.save())),
  }
}

// ---- in-page helpers ----

const navExpr = (route) => `(() => { window.location.hash = ${JSON.stringify(route)}; return true })()`

const bodyText = 'document.body.innerText'

const clickButtonExpr = (text) => `(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)});
  if (!b) return false;
  b.click();
  return true;
})()`

/** Seeds a pending job into the renderer's persistent queue (IndexedDB). */
function seedPendingJobExpr(job) {
  return `(async () => {
    const entry = ${JSON.stringify(job)};
    const req = indexedDB.open('fileforge_jobs', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queued')) db.createObjectStore('queued', { keyPath: 'id' });
    };
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('queued', 'readwrite');
        tx.objectStore('queued').put(entry);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  })()`
}

function readQueuedJobExpr(id) {
  return `(async () => {
    const req = indexedDB.open('fileforge_jobs', 1);
    return await new Promise((resolve) => {
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('queued', 'readonly');
        const g = tx.objectStore('queued').get(${JSON.stringify(id)});
        g.onsuccess = () => resolve(g.result ?? null);
        g.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  })()`
}

function clearQueueExpr() {
  return `(async () => {
    const req = indexedDB.open('fileforge_jobs', 1);
    return await new Promise((resolve) => {
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('queued')) { resolve(true); return; }
        const tx = db.transaction('queued', 'readwrite');
        tx.objectStore('queued').clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    });
  })()`
}

const setSettingsExpr = (settings) =>
  `(() => { localStorage.setItem('fileforge_settings', ${JSON.stringify(JSON.stringify(settings))}); return true })()`

const approvePathsExpr = (paths) =>
  `window.fileforge.approvePaths(${JSON.stringify(paths)})`

const statOfExpr = (filePath) =>
  `window.fileforge.statFile(${JSON.stringify(filePath)})`

const savedPathFromBody = `(() => {
  const m = document.body.innerText.match(/Saved to ([^\\n]+)/);
  return m ? m[1].trim() : null;
})()`

const reloadExpr = `(() => { window.location.reload(); return true })()`

function bridgeJobEntry(id, toolId, fixture, options, outputName) {
  return {
    id,
    toolId,
    status: 'pending',
    inputs: [
      {
        id: `in_${id}`,
        name: fixture.name,
        size: fixture.size,
        type: 'image/png',
        lastModified: Date.now(),
        path: fixture.path,
      },
    ],
    options,
    outputName,
    createdAt: Date.now(),
    progress: { percent: 0 },
  }
}

const DEFAULT_SETTINGS = {
  storagePreference: 'ask',
  autoCleanup: true,
  cleanupAgeDays: 30,
  defaultOutputDir: '',
  maxConcurrentJobs: 2,
  resumePendingJobs: true,
  notificationsEnabled: false,
  autoCheckUpdates: false,
  overwriteProtection: 'autorename',
}

async function main() {
  const fixturesDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ff14-verify-'))
  let launched

  try {
    console.log('Generating fixtures…')
    const fx = await generateFixtures(fixturesDir)

    // =====================================================================
    // LAUNCH 1 — pipeline round trips via bridge + security + disk assert
    // =====================================================================
    console.log('\n=== Launch 1 — select → process → save (IPC pipeline) ===')
    try {
      launched = await launch()
      const { cdp } = launched

      const platform = await cdp.evaluate('window.fileforge.getPlatform()')
      const version = await cdp.evaluate('window.fileforge.getVersion()')
      const max = await cdp.evaluate('window.fileforge.isMaximized()')
      const title = await cdp.evaluate('document.title')
      report('bridge exposed + env', !!platform && !!version && title.includes('FileForge'), `platform=${platform} version=${version} title=${title}`)
      report('window starts unmaximized', max === false)

      await cdp.evaluate(approvePathsExpr(Object.values(fx).map((f) => f.path)))
      const tempDir = await cdp.evaluate('window.fileforge.getTempDir()')
      report('temp dir available', typeof tempDir === 'string' && tempDir.length > 0)

      // image.convert — single file → JPEG on disk, explicit save dir, temp cleanup
      const saveDir = path.join(fixturesDir, 'saved')
      const img = await cdp.evaluate(`(async () => {
        const fg = window.fileforge;
        const req = { requestId: 'p14-img', kind: 'image.convert', files: [${JSON.stringify(fx.input)}], options: { format: 'jpeg', quality: 80, stripMetadata: true } };
        try {
          const res = await fg.runEngine(req);
          const st = await fg.statFile(res.outputPath);
          const saved = await fg.saveOutputFile({ sourcePath: res.outputPath, suggestedName: 'img-out.jpg', outputDir: ${JSON.stringify(saveDir)}, overwriteMode: 'autorename' });
          const savedStat = saved ? await fg.statFile(saved.path) : null;
          await fg.cleanupJobTemp(req.requestId);
          const after = await fg.statFile(res.outputPath);
          return { ok: true, filename: res.filename, outputSize: res.outputSize, st, saved, savedStat, cleaned: after === null };
        } catch (err) {
          return { ok: false, error: String(err && err.message || err) };
        }
      })()`)
      let imgHead = null
      if (img.ok && img.saved) {
        imgHead = await readHeadWithRetry(img.saved.path)
      }
      report(
        'image.convert produces a JPEG artifact (real bytes on disk)',
        img.ok && img.outputSize > 0 && img.st && img.st.isFile === true && imgHead && imgHead[0] === 0xff && imgHead[1] === 0xd8,
        imgHead ? `${img.filename} bytes=${imgHead.map((b) => b.toString(16)).join(' ')}` : img.error,
      )
      report(
        'saveOutputFile saves beside an explicit target dir',
        img.ok && img.saved && img.saved.location === 'outputDir' && !!img.savedStat,
        img.ok ? `${img.saved && img.saved.path}` : 'no save',
      )
      report('cleanupJobTemp removes the job temp dir', !!img.cleaned)

      // image.convert — multi-file batch emits progress marks and saves a ZIP
      const batch = await cdp.evaluate(`(async () => {
        const fg = window.fileforge;
        const req = { requestId: 'p14-batch', kind: 'image.convert', files: [${JSON.stringify(fx.input)}, ${JSON.stringify(fx.input2)}], options: { format: 'jpeg', quality: 80 } };
        const progress = [];
        const off = fg.onEngineProgress((e) => { if (e.requestId === req.requestId) progress.push(e.percent); });
        try {
          const res = await fg.runEngine(req);
          off();
          const saved = await fg.saveOutputFile({ sourcePath: res.outputPath, suggestedName: 'batch.zip', outputDir: ${JSON.stringify(saveDir)}, overwriteMode: 'autorename' });
          const savedStat = saved ? await fg.statFile(saved.path) : null;
          await fg.cleanupJobTemp(req.requestId);
          return { ok: true, progress, outputSize: res.outputSize, zipSaved: !!savedStat };
        } catch (err) {
          return { ok: false, error: String(err && err.message || err) };
        }
      })()`)
      const sortedProgress = batch.ok ? [...batch.progress].sort((a, b) => a - b) : []
      report(
        'multi-file image.convert streams progress to the renderer',
        batch.ok && batch.progress.length >= 3 && sortedProgress[sortedProgress.length - 1] === 100,
        batch.ok ? `progress=${batch.progress.join(',')}` : batch.error,
      )
      report(
        'multi-file image.convert saves the batch ZIP beside the explicit dir',
        batch.ok && batch.zipSaved && batch.outputSize > 0,
        batch.ok ? `out=${batch.outputSize}B` : batch.error,
      )

      // zip.create then zip.extract round trip (approve the engine output first)
      const zip = await cdp.evaluate(`(async () => {
        const fg = window.fileforge;
        const zreq = { requestId: 'p14-zip', kind: 'zip.create', files: [${JSON.stringify(fx.txtA)}, ${JSON.stringify(fx.txtB)}], options: { level: 6 } };
        const z = await fg.runEngine(zreq);
        await fg.approvePaths([z.outputPath]);
        const zsave = await fg.saveOutputFile({ sourcePath: z.outputPath, suggestedName: 'bundle.zip', outputDir: ${JSON.stringify(saveDir)}, overwriteMode: 'autorename' });
        const xreq = { requestId: 'p14-zipx', kind: 'zip.extract', files: [{ path: z.outputPath, name: 'bundle.zip', size: z.outputSize }], options: {} };
        const x = await fg.runEngine(xreq);
        const xsave = await fg.saveOutputFile({ sourcePath: x.outputPath, suggestedName: 'extracted.zip', outputDir: ${JSON.stringify(saveDir)}, overwriteMode: 'autorename' });
        await fg.cleanupJobTemp(zreq.requestId);
        await fg.cleanupJobTemp(xreq.requestId);
        const zs = zsave ? await fg.statFile(zsave.path) : null;
        const xs = xsave ? await fg.statFile(xsave.path) : null;
        return { ok: true, zOut: z.outputSize, xOut: x.outputSize, zsaved: !!zs, xsaved: xs && xs.isFile };
      })().catch((e) => ({ ok: false, error: String(e && e.message || e) }))`)
      report(
        'zip.create → zip.extract round trip saves both outputs',
        zip.ok && zip.zOut > 0 && zip.xOut > 0 && zip.zsaved && zip.xsaved,
        zip.ok ? `zip=${zip.zOut}B extract=${zip.xOut}B` : zip.error,
      )

      // pdf.merge
      const pdf = await cdp.evaluate(`(async () => {
        const fg = window.fileforge;
        const req = { requestId: 'p14-pdf', kind: 'pdf.merge', files: [${JSON.stringify(fx.pdfA)}, ${JSON.stringify(fx.pdfB)}], options: {} };
        const res = await fg.runEngine(req);
        const saved = await fg.saveOutputFile({ sourcePath: res.outputPath, suggestedName: 'merged.pdf', outputDir: ${JSON.stringify(saveDir)}, overwriteMode: 'autorename' });
        await fg.cleanupJobTemp(req.requestId);
        return { ok: true, size: res.outputSize, savedPath: saved && saved.path };
      })().catch((e) => ({ ok: false, error: String(e && e.message || e) }))`)
      let pdfHead = null
      if (pdf.ok && pdf.savedPath) {
        pdfHead = await readHeadWithRetry(pdf.savedPath)
      }
      report(
        'pdf.merge saves a valid PDF on disk',
        pdf.ok && pdf.size > 0 && pdfHead && pdfHead.slice(0, 4).every((b, i) => b === '%PDF'.charCodeAt(i)),
        pdf.ok ? `size=${pdf.size}B` : pdf.error,
      )

      // cancel mid-flight on a heavy image.compress
      const cancel = await cdp.evaluate(`(async () => {
        const fg = window.fileforge;
        const req = { requestId: 'p14-cancel', kind: 'image.compress', files: [${JSON.stringify(fx.slow)}], options: { quality: 95, stripMetadata: true } };
        const run = fg.runEngine(req);
        await new Promise((r) => setTimeout(r, 300));
        await fg.cancelEngine(req.requestId);
        try {
          await run;
          return { result: 'completed-anyway' };
        } catch (e) {
          return { result: 'aborted', error: String(e && e.message || e) };
        }
      })()`)
      report('cancelEngine aborts a running heavy request', cancel.result === 'aborted', `result=${cancel.result}`)

      // security: IPC argument validation rejects malformed calls
      const sec = await cdp.evaluate(`(async () => {
        const fg = window.fileforge;
        const results = {};
        for (const [key, fn] of Object.entries({
          engineRun: () => fg.invoke('engine:run', 'not-an-object'),
          engineRunFiles: () => fg.invoke('engine:run', { requestId: 'x', kind: 'image.convert', files: [{ path: 'C:\\\\evil', name: 'a.png' }] }),
          saveOutput: () => fg.invoke('file:saveOutputFile', null),
        })) {
          try { await fn(); results[key] = false; } catch { results[key] = true; }
        }
        return results;
      })()`)
      report(
        'IPC handlers reject malformed arguments',
        sec.engineRun && sec.engineRunFiles && sec.saveOutput,
        JSON.stringify(sec),
      )
    } finally {
      if (launched) await close(launched.child, launched.cdp)
      launched = null
    }

    // =====================================================================
    // LAUNCH 2 — UI queue lifecycle + workspace auto-save on disk
    // =====================================================================
    console.log('\n=== Launch 2 — renderer UI: select/process/save through the real queue ===')
    try {
      launched = await launch()
      const { cdp } = launched

      // pre-conditions: quiet settings, approved input, clean queue, seeded pending job
      await cdp.evaluate(setSettingsExpr(DEFAULT_SETTINGS))
      await cdp.evaluate(clearQueueExpr())
      await cdp.evaluate(approvePathsExpr([fx.slow.path]))
      await cdp.evaluate(
        seedPendingJobExpr(
          bridgeJobEntry('ui-img', 'image-compress', fx.slow, { quality: 95, stripMetadata: true }, 'general.png'),
        ),
      )

      // land on #/jobs and reload so the app restores the pending job
      await cdp.evaluate(navExpr('#/jobs'))
      await cdp.evaluate(reloadExpr)
      await waitForBridge(cdp)
      await waitFor(cdp, `document.querySelector('main h1') != null`, 'jobs page renders')
      await waitFor(cdp, `document.body.innerText.includes('Image Compress') && document.body.innerText.includes('Cancel')`, 'restored job appears as Active with Cancel', 30000)
      report('restored pending job resumes through the real queue (Active + Cancel)', true)

      // jump into the tool workspace while it is still processing → auto-save runs
      await cdp.evaluate(navExpr('#/tool/image-compress'))
      await waitFor(cdp, `document.querySelector('main h1') != null`, 'workspace renders')
      await waitFor(cdp, `document.body.innerText.includes('Saved to ')`, 'workspace auto-saves the finished job', 30000)
      const savedPath = await cdp.evaluate(savedPathFromBody)
      const st = savedPath ? await cdp.evaluate(statOfExpr(savedPath)) : null
      const head = await readHeadWithRetry(savedPath)
      const isJpeg = head && head[0] === 0xff && head[1] === 0xd8
      const isPng = head && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
      report(
        'workspace auto-save writes the result to disk (valid image)',
        !!st && st.isFile === true && st.size > 0 && (isJpeg || isPng),
        savedPath
          ? `${savedPath} (${st && st.size}B) head=${head ? head.map((b) => b.toString(16)).join(' ') : 'unreadable'}`
          : 'no saved path in UI',
      )
      report(
        'saved output offers desktop actions (Open file / Open folder / Copy path)',
        await cdp.evaluate(`(() => {
          const t = document.body.innerText;
          return t.includes('Open file') && t.includes('Open folder') && t.includes('Copy path');
        })()`),
      )

      // the Jobs list reflects the finished job
      await cdp.evaluate(navExpr('#/jobs'))
      await waitFor(cdp, `document.body.innerText.includes('✓ Completed')`, 'job shown as completed in Jobs list')
      const jobsListState = await cdp.evaluate(
        'document.body.innerText.includes("Saved to") && document.body.innerText.includes("Remove")',
      )
      report('Jobs list marks the job completed with the saved path', jobsListState)

      // failure path: a pathless synthetic drop → readable error surfaced in the UI
      await cdp.evaluate(navExpr('#/tool/zip-create'))
      await waitFor(cdp, `document.querySelector('main h1') != null`, 'zip-create workspace renders')
      const dropped = await cdp.evaluate(`(() => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(16)], 'nope.txt', { type: 'text/plain' }));
        const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
        const zone = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Browse files'));
        if (!zone) return false;
        zone.dispatchEvent(drop);
        return true;
      })()`)
      await waitFor(cdp, `document.body.innerText.includes('nope.txt') && document.body.innerText.includes('Run')`, 'dropped file is listed and Run is available')
      await cdp.evaluate(clickButtonExpr('Run'))
      await waitFor(cdp, `document.body.innerText.includes('Failed') && document.querySelector('[role="alert"]') != null`, 'failed job surfaces a readable alert')
      const failedText = await cdp.evaluate(`(() => {
        const a = document.querySelector('[role="alert"]');
        return a ? a.textContent.trim().slice(0, 90) : '';
      })()`)
      report('pathless input fails cleanly with a readable UI alert', /not available on disk|Something went wrong|failed/i.test(failedText), failedText)
    } finally {
      if (launched) await close(launched.child, launched.cdp)
      launched = null
    }

    // =====================================================================
    // LAUNCH 3 — cancel a running job through the UI
    // =====================================================================
    console.log('\n=== Launch 3 — renderer UI: cancel a running job ===')
    try {
      launched = await launch()
      const { cdp } = launched

      await cdp.evaluate(setSettingsExpr(DEFAULT_SETTINGS))
      await cdp.evaluate(clearQueueExpr())
      await cdp.evaluate(approvePathsExpr([fx.slow.path]))
      await cdp.evaluate(
        seedPendingJobExpr(
          bridgeJobEntry('ui-cancel', 'image-compress', fx.slow, { quality: 95, stripMetadata: true }, 'willstop.jpg'),
        ),
      )

      await cdp.evaluate(navExpr('#/jobs'))
      await cdp.evaluate(reloadExpr)
      await waitForBridge(cdp)
      await waitFor(cdp, `document.querySelector('main h1') != null`, 'jobs page renders')
      await waitFor(cdp, `document.body.innerText.includes('Cancel')`, 'running job exposes a Cancel button', 30000)

      const clickedCancel = await cdp.evaluate(clickButtonExpr('Cancel'))
      await waitFor(cdp, `document.body.innerText.includes('Cancelled')`, 'job transitions to Cancelled')
      const queueState = await cdp.evaluate(readQueuedJobExpr('ui-cancel'))
      report('UI Cancel button stops the engine and marks the job cancelled', clickedCancel && queueState === null, `clicked=${clickedCancel}`)
    } finally {
      if (launched) await close(launched.child, launched.cdp)
      launched = null
    }

    // =====================================================================
    // LAUNCH 4 — settings UI + axe accessibility scan
    // =====================================================================
    console.log('\n=== Launch 4 — settings UI interaction + axe accessibility ===')
    try {
      launched = await launch()
      const { cdp } = launched

      await cdp.evaluate(setSettingsExpr(DEFAULT_SETTINGS))

      // navigation via a real nav link
      await waitFor(cdp, `document.querySelector('main h1') != null`, 'home renders')
      const navHit = await cdp.evaluate(`(() => {
        const links = [...document.querySelectorAll('a')];
        const l = links.find((a) => a.textContent.trim() === 'Settings');
        if (!l) return false;
        l.click();
        return true;
      })()`)
      await waitFor(cdp, `document.querySelector('h1') && document.querySelector('h1').textContent.trim() === 'Settings'`, 'settings page opens via nav link')
      report('navigation to Settings works through the real link', navHit)

      const before = await cdp.evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').startsWith('Job completion toasts'));
        return b ? { pressed: b.getAttribute('aria-pressed') } : null;
      })()`)
      if (before) {
        const expectedTurnOff = before.pressed === 'true'
        await cdp.evaluate(clickButtonExpr(expectedTurnOff ? 'On' : 'Off'))
        await waitFor(cdp, `document.querySelector('h1') != null`, 'settings still mounted')
        const after = await cdp.evaluate(`(() => {
          const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').startsWith('Job completion toasts'));
          return b ? b.getAttribute('aria-pressed') : null;
        })()`)
        const toggled = expectedTurnOff ? after === 'false' : after === 'true'
        await cdp.evaluate(clickButtonExpr('Save Settings'))
        const stored = await cdp.evaluate(`JSON.parse(localStorage.getItem('fileforge_settings') || '{}').notificationsEnabled !== ${expectedTurnOff ? 'true' : 'false'}`)
        report('settings toggle persists through Save Settings', toggled && stored, `before=${before.pressed} after=${after} stored=${stored}`)
      } else {
        report('settings toggle persists through Save Settings', false, 'notifications toggle not found')
      }

      // axe scan across the main routes
      const axeSrc = await fsp.readFile(path.join(root, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
      report('axe-core loads in the live renderer', await cdp.evaluate(`${axeSrc}
;(function () { return typeof window.axe === 'object' && typeof window.axe.run === 'function'; })()`))

      const routes = [
        { route: '#/', wait: `document.body.innerText.includes('Welcome to FileForge')` },
        { route: '#/tools', wait: `document.body.innerText.includes('Tools')` },
        { route: '#/tool/image-convert', wait: `document.body.innerText.includes('Browse files')` },
        { route: '#/jobs', wait: `document.body.innerText.includes('Jobs')` },
        { route: '#/settings', wait: `document.body.innerText.includes('Settings')` },
      ]
      const axeResults = await cdp.evaluate(`(async () => {
        const out = [];
        for (const r of ${JSON.stringify(routes)}) {
          window.location.hash = r.route;
          await new Promise((res) => setTimeout(res, 700));
          const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] } });
          out.push({
            route: r.route,
            violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
          });
        }
        return out;
      })()`)
      const CONTRAST = 'color-contrast'
      let blocking = 0
      for (const r of axeResults) {
        const serious = r.violations.filter((v) => (v.impact === 'critical' || v.impact === 'serious') && v.id !== CONTRAST)
        const contrast = r.violations.filter((v) => v.id === CONTRAST)
        if (serious.length > 0) blocking++
        report(
          `axe ${r.route} has no critical/serious violations (excluding color-contrast)`,
          serious.length === 0,
          serious.map((v) => `${v.id}=${v.nodes}`).join(', ') || `ok; contrast=${contrast.reduce((n, v) => n + v.nodes, 0)} nodes`,
        )
      }
      console.log('  (color-contrast node counts recorded separately: ' +
        axeResults.map((r) => `${r.route} → ${r.violations.filter((v) => v.id === CONTRAST).reduce((n, v) => n + v.nodes, 0)}`).join(' · ') + ')')
    } finally {
      if (launched) await close(launched.child, launched.cdp)
      launched = null
    }
  } finally {
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