import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ITERATIONS = Number(process.env.BENCH_ITERATIONS || 3)
const WARMUP = 1

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

async function launch() {
  const child = spawn(electronBin, [path.join(root, 'out', 'main', 'main.js'), '--remote-debugging-port=0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: process.env,
  })
  let stderrBuffer = ''
  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString()
  })

  const port = await new Promise((resolve, reject) => {
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
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      targets = await res.json()
      if (targets.some((t) => t.type === 'page' && t.webSocketDebuggerUrl)) break
    } catch {
      // not ready
    }
    await sleep(250)
  }

  for (const target of targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)) {
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve)
      ws.addEventListener('error', () => reject(new Error('WebSocket connect failed')))
    })
    const cdp = new CDP(ws)
    await cdp.send('Runtime.enable')
    const readyDeadline = Date.now() + 15000
    let ok = false
    while (Date.now() < readyDeadline) {
      try {
        if (await cdp.evaluate('typeof window.fileforge === "object" && window.fileforge !== null')) {
          ok = true
          break
        }
      } catch {
        // keep polling
      }
      await sleep(200)
    }
    if (ok) return { child, cdp }
    ws.close()
  }
  throw new Error('No renderer target exposed window.fileforge')
}

function close(child, cdp) {
  try {
    cdp.ws.close()
  } catch {
    // ignore
  }
  if (child.exitCode === null) child.kill()
}

function noisePng(width, height, seed = 1) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(width, height)
  const data = img.data
  let state = seed || 1
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = next() & 0xff
    data[i + 1] = (next() >>> 8) & 0xff
    data[i + 2] = (next() >>> 16) & 0xff
    data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toBuffer('image/png')
}

async function makePdf(pages) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842])
    page.drawText(`FileForge benchmark page ${i + 1}`, { x: 40, y: 800, size: 12 })
  }
  return Buffer.from(await doc.save())
}

async function generateFixtures(dir) {
  const write = async (name, data) => {
    const filePath = path.join(dir, name)
    await fsp.writeFile(filePath, data)
    const stat = await fsp.stat(filePath)
    return { path: filePath, name, size: stat.size }
  }
  return {
    png1: await write('bench-1mp.png', noisePng(1000, 1000, 3)),
    png4: await write('bench-4mp.png', noisePng(2000, 2000, 5)),
    png8: await write('bench-8mp.png', noisePng(2828, 2828, 9)),
    blob1: await write('bench-1mb.bin', randomBytes(1 * 1024 * 1024)),
    blob6: await write('bench-6mb.bin', randomBytes(6 * 1024 * 1024)),
    pdf2: await write('bench-2p.pdf', await makePdf(2)),
    pdf2b: await write('bench-2p-b.pdf', await makePdf(3)),
    pdf10: await write('bench-10p.pdf', await makePdf(10)),
    pdf10b: await write('bench-10p-b.pdf', await makePdf(11)),
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const cases = []
function defineCase(row) {
  cases.push(row)
  return row
}

async function main() {
  const fixturesDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ff14-bench-'))
  let launched

  try {
    const fx = await generateFixtures(fixturesDir)

    defineCase({
      id: 'image.convert 1MP',
      group: 'Images',
      kind: 'image.convert',
      files: [fx.png1],
      options: { format: 'jpeg', quality: 80 },
      inputLabel: '1.0 MP (1000×1000)',
    })
    defineCase({
      id: 'image.convert 4MP',
      group: 'Images',
      kind: 'image.convert',
      files: [fx.png4],
      options: { format: 'jpeg', quality: 80 },
      inputLabel: '4.0 MP (2000×2000)',
    })
    defineCase({
      id: 'image.convert 8MP',
      group: 'Images',
      kind: 'image.convert',
      files: [fx.png8],
      options: { format: 'jpeg', quality: 80 },
      inputLabel: '8.0 MP (2828×2828)',
    })
    defineCase({
      id: 'image.compress 8MP',
      group: 'Images',
      kind: 'image.compress',
      files: [fx.png8],
      options: { quality: 80, stripMetadata: true },
      inputLabel: '8.0 MP (2828×2828)',
    })
    defineCase({
      id: 'image.resize 8MP → 1280',
      group: 'Images',
      kind: 'image.resize',
      files: [fx.png8],
      options: { width: 1280, quality: 80 },
      inputLabel: '8.0 MP (2828×2828)',
    })
    defineCase({
      id: 'zip.create 1MB',
      group: 'Archives',
      kind: 'zip.create',
      files: [fx.blob1],
      options: { level: 6 },
      inputLabel: '1.00 MB',
    })
    defineCase({
      id: 'zip.create 6MB',
      group: 'Archives',
      kind: 'zip.create',
      files: [fx.blob6],
      options: { level: 6 },
      inputLabel: '6.00 MB',
    })
    defineCase({
      id: 'computeHash 6MB',
      group: 'Archives',
      kind: 'computeHash',
      files: [fx.blob6],
      options: {},
      inputLabel: '6.00 MB',
    })
    defineCase({
      id: 'pdf.merge 2 pages',
      group: 'PDF',
      kind: 'pdf.merge',
      files: [fx.pdf2, fx.pdf2b],
      options: {},
    })
    defineCase({
      id: 'pdf.merge 10 pages',
      group: 'PDF',
      kind: 'pdf.merge',
      files: [fx.pdf10, fx.pdf10b],
      options: {},
    })

    console.log(`Launching Electron (${ITERATIONS} iterations + ${WARMUP} warmup)…`)
    launched = await launch()
    const { cdp } = launched

    await cdp.evaluate(`window.fileforge.approvePaths(${JSON.stringify(Object.values(fx).map((f) => f.path))})`)

    const runOne = (benchCase) => {
      const requestId = `bench-${Date.now()}-${Math.random().toString(36).slice(2)}`
      return cdp.evaluate(`(async () => {
        const fg = window.fileforge;
        const req = {
          requestId: ${JSON.stringify(requestId)},
          kind: ${JSON.stringify(benchCase.kind)},
          files: ${JSON.stringify(benchCase.files.map((f) => ({ path: f.path, name: f.name, size: f.size })))},
          options: ${JSON.stringify(benchCase.options)},
        };
        const t0 = performance.now();
        const res = await fg.runEngine(req);
        const t1 = performance.now();
        await fg.cleanupJobTemp(req.requestId);
        return { ms: t1 - t0, outputSize: res && res.outputSize ? res.outputSize : 0 };
      })()`)
    }

    const measured = []
    for (const benchCase of cases) {
      const samples = []
      let outputSize = 0
      for (let i = 0; i < WARMUP + ITERATIONS; i++) {
        const result = await runOne(benchCase)
        if (i >= WARMUP) samples.push(result.ms)
        outputSize = result.outputSize
      }
      const row = {
        ...benchCase,
        samples,
        median: median(samples),
        min: Math.min(...samples),
        max: Math.max(...samples),
        outputSize,
      }
      measured.push(row)
      console.log(`  ${benchCase.id.padEnd(26)} median=${row.median.toFixed(0)}ms  min=${row.min.toFixed(0)}  max=${row.max.toFixed(0)}`)
    }

    const cpus = os.cpus()
    const env = {
      date: new Date().toISOString(),
      platform: `${os.type()} ${os.release()}`,
      arch: process.arch,
      cpu: cpus.length ? `${cpus[0].model.trim()} (${cpus.length} threads)` : 'unknown',
      totalRamGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
      electron: await cdp.evaluate('window.fileforge.getVersion()'),
      iterations: ITERATIONS,
    }

    const md = []
    md.push('### Environment')
    md.push('')
    md.push(`- **Date:** ${env.date}`)
    md.push(`- **OS:** ${env.platform} (${env.arch})`)
    md.push(`- **CPU:** ${env.cpu}`)
    md.push(`- **RAM:** ${env.totalRamGB} GB`)
    md.push(`- **Electron:** ${env.electron}`)
    md.push(`- **Method:** end-to-end \`runEngine\` round trip through the Electron IPC bridge (worker + disk I/O included), ${env.iterations} measured iterations after ${WARMUP} warmup; median reported.`)
    md.push('')
    md.push('| Group | Operation | Input | Median (ms) | Min (ms) | Max (ms) | Output (KB) |')
    md.push('| --- | --- | --- | ---: | ---: | ---: | ---: |')
    for (const row of measured) {
      const input = row.inputLabel ?? '—'
      const output = row.outputSize ? (row.outputSize / 1024).toFixed(0) : '—'
      md.push(
        `| ${row.group} | ${row.id} | ${input} | ${row.median.toFixed(0)} | ${row.min.toFixed(0)} | ${row.max.toFixed(0)} | ${output} |`,
      )
    }
    md.push('')

    const outFile = path.join(root, 'benchmark-results.md')
    await fsp.writeFile(outFile, `${md.join('\n')}\n`)
    console.log(`\nWrote ${outFile}`)
  } finally {
    if (launched) close(launched.child, launched.cdp)
    await fsp.rm(fixturesDir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((err) => {
  console.error(`\nBenchmark error: ${err.stack || err.message}`)
  process.exit(1)
})
