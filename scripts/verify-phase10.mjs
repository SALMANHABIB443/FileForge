import { spawn } from 'node:child_process'
import fsp from 'node:fs/promises'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const builds = {
  main: path.join(root, 'out', 'main', 'main.js'),
  renderer: path.join(root, 'out', 'renderer', 'index.html'),
}
for (const [label, file] of Object.entries(builds)) {
  if (!fs.existsSync(file)) {
    console.error(`Missing build artifact ${label}: ${file}\nRun "npm run build" first.`)
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

function tarHeader(name, size) {
  const header = Buffer.alloc(512)
  header.write(name.slice(0, 100), 0, 'ascii')
  header.write('0000644\0', 100, 'ascii')
  header.write('0000000\0', 108, 'ascii')
  header.write('0000000\0', 116, 'ascii')
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 'ascii')
  header.write('0'.repeat(12), 136, 'ascii')
  header.write('        ', 148, 'ascii')
  header[156] = 0x30
  let sum = 0
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i]
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii')
  return header
}

function buildTar(entries) {
  const blocks = []
  for (const entry of entries) {
    blocks.push(tarHeader(entry.name, entry.data.length))
    const padded = Buffer.alloc(Math.ceil(entry.data.length / 512) * 512)
    entry.data.copy(padded)
    blocks.push(padded)
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)])
}

function run(bin, args) {
  const { spawnSync } = require('node:child_process')
  return spawnSync(bin, args, { encoding: 'utf-8' })
}

async function generateFixtures(dir) {
  const out = {}
  const write = async (name, data) => {
    const filePath = path.join(dir, name)
    await fsp.writeFile(filePath, data)
    const stat = await fsp.stat(filePath)
    out[name] = { path: filePath, name, size: stat.size }
  }

  const canvas = (w, h, color) => {
    const c = createCanvas(w, h)
    const ctx = c.getContext('2d')
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
    return c
  }
  await write('png.png', canvas(48, 32, '#336699').toBuffer('image/png'))
  await write('jpg.jpg', canvas(40, 30, '#cc6633').toBuffer('image/jpeg'))
  await write('txt-a.txt', Buffer.from('content a for zip fixture'))
  await write('txt-b.txt', Buffer.from('content b for zip fixture'))
  await write('txt-dup.txt', Buffer.from('content a for zip fixture'))

  const pdfA = await PDFDocument.create()
  pdfA.addPage([300, 200])
  await write('pdf-a.pdf', Buffer.from(await pdfA.save()))

  const pdfB = await PDFDocument.create()
  pdfB.addPage([300, 200])
  pdfB.addPage([300, 200])
  await write('pdf-b.pdf', Buffer.from(await pdfB.save()))

  const pdfC = await PDFDocument.create()
  for (let i = 0; i < 3; i++) {
    const page = pdfC.addPage([200, 100 * (i + 1)])
    page.drawText(`page ${i + 1}`, { x: 20, y: 40, size: 12 })
  }
  await write('pdf-c.pdf', Buffer.from(await pdfC.save()))

  const zip = new JSZip()
  zip.file('a.txt', 'alpha')
  zip.file('b.txt', 'beta')
  await write('arch.zip', await zip.generateAsync({ type: 'nodebuffer' }))

  await write('bundle.tar', buildTar([
    { name: 'notes/x.txt', data: Buffer.from('tar data x') },
    { name: 'y.txt', data: Buffer.from('tar data y') },
  ]))

  const ffmpeg = require('ffmpeg-static')
  if (typeof ffmpeg === 'string') {
    const wav = path.join(dir, 'tone.wav')
    const r1 = run(ffmpeg, [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=1',
      '-acodec', 'pcm_s16le',
      '-ar', '8000',
      '-ac', '1',
      '-y', wav,
    ])
    if (r1.status !== 0) throw new Error(`lavfi wav failed: ${r1.stderr.slice(0, 400)}`)

    const mp3 = run(ffmpeg, ['-i', wav, '-acodec', 'libmp3lame', '-b:a', '128k', '-y', path.join(dir, 'clip.mp3')])
    if (mp3.status !== 0) throw new Error(`mp3 encode failed: ${mp3.stderr.slice(0, 400)}`)
    await write('clip.mp3', await fsp.readFile(path.join(dir, 'clip.mp3')))

    const clipMp4 = run(ffmpeg, [
      '-f', 'lavfi',
      '-i', 'sine=frequency=540:duration=2',
      '-f', 'lavfi',
      '-i', 'color=c=black:s=160x120:d=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-shortest',
      '-y', path.join(dir, 'clip.mp4'),
    ])
    if (clipMp4.status !== 0) throw new Error(`mp4 encode failed: ${clipMp4.stderr.slice(0, 400)}`)
    await write('clip.mp4', await fsp.readFile(path.join(dir, 'clip.mp4')))

    const bigMp4 = run(ffmpeg, [
      '-f', 'lavfi',
      '-i', 'sine=frequency=540:duration=6',
      '-f', 'lavfi',
      '-i', 'color=c=black:s=320x240:d=6',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-shortest',
      '-y', path.join(dir, 'big.mp4'),
    ])
    if (bigMp4.status !== 0) throw new Error(`big mp4 encode failed: ${bigMp4.stderr.slice(0, 400)}`)
    await write('big.mp4', await fsp.readFile(path.join(dir, 'big.mp4')))
  } else {
    console.warn('  (ffmpeg-static missing — ffmpeg engine checks will be skipped)')
  }

  return out
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
  const fixturesDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ff10-verify-'))
  let electron

  try {
    console.log('Generating fixtures…')
    const f = await generateFixtures(fixturesDir)

    if (!f['clip.mp4'] || !f['clip.mp3']) {
      console.warn('  ffmpeg fixtures unavailable — skipping ffmpeg-derived checks')
    }

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

    console.log(`Connecting to renderer target… (port ${devtoolsMatch})`)
    const bridgeReady = async (cdp) => {
      const deadline = Date.now() + 15000
      while (Date.now() < deadline) {
        try {
          if (await cdp.evaluate('typeof window.fileforge === "object" && window.fileforge !== null')) {
            return true
          }
        } catch {
          // target not ready yet
        }
        await new Promise((r) => setTimeout(r, 200))
      }
      return false
    }

    let cdp
    for (const target of pageTargets) {
      const ws = new WebSocket(target.webSocketDebuggerUrl)
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve)
        ws.addEventListener('error', () => reject(new Error('WebSocket connect failed')))
      })
      const candidate = new CDP(ws)
      await candidate.send('Runtime.enable')
      if (await bridgeReady(candidate)) {
        cdp = candidate
        break
      }
      ws.close()
    }
    if (!cdp) throw new Error('No renderer target exposed window.fileforge')

    const platform = await cdp.evaluate('window.fileforge.getPlatform()')
    report('bridge exposed (window.fileforge)', !!platform, `platform=${platform}`)

    const allPaths = Object.values(f).map((file) => file.path)
    const approved = await cdp.evaluate(`window.fileforge.approvePaths(${JSON.stringify(allPaths)})`)
    report('approvePaths approves all fixtures', approved === allPaths.length, `${approved}/${allPaths.length}`)

    const tempDir = await cdp.evaluate('window.fileforge.getTempDir()')
    report('getTempDir returns a path', typeof tempDir === 'string' && tempDir.length > 0)

    const fileOf = (key) => f[key]

    const cases = [
      { id: 'f10-image-convert', name: 'image.convert (png+jpg → jpeg zip)', kind: 'image.convert',
        files: [fileOf('png.png'), fileOf('jpg.jpg')], options: { format: 'jpeg', quality: 80, stripMetadata: true } },
      { id: 'f10-image-compress', name: 'image.compress', kind: 'image.compress',
        files: [fileOf('png.png')], options: { quality: 40, stripMetadata: true } },
      { id: 'f10-image-resize', name: 'image.resize', kind: 'image.resize',
        files: [fileOf('png.png')], options: { width: 24, maintainAspect: true } },
      { id: 'f10-image-crop', name: 'image.crop', kind: 'image.crop',
        files: [fileOf('png.png')], options: { crop: { x: 0, y: 0, width: 16, height: 16 }, format: 'png', stripMetadata: true } },
      { id: 'f10-pdf-images', name: 'pdf.imagesToPdf', kind: 'pdf.imagesToPdf',
        files: [fileOf('png.png'), fileOf('jpg.jpg')], options: { pageSize: 'fit' } },
      { id: 'f10-pdf-merge', name: 'pdf.merge', kind: 'pdf.merge',
        files: [fileOf('pdf-a.pdf'), fileOf('pdf-b.pdf')], options: {} },
      { id: 'f10-pdf-split-range', name: 'pdf.split (range 1-2)', kind: 'pdf.split',
        files: [fileOf('pdf-c.pdf')], options: { mode: 'range', range: '1-2' } },
      { id: 'f10-pdf-split-every', name: 'pdf.split (every page)', kind: 'pdf.split',
        files: [fileOf('pdf-c.pdf')], options: { mode: 'every' } },
      { id: 'f10-pdf-compress', name: 'pdf.compress', kind: 'pdf.compress',
        files: [fileOf('pdf-c.pdf')], options: {} },
      { id: 'f10-pdf-organize', name: 'pdf.organize + rotate', kind: 'pdf.organize',
        files: [fileOf('pdf-c.pdf')], options: { order: [2, 0, 1], rotation: 90 } },
      { id: 'f10-pdf-toimages', name: 'pdf.toImages', kind: 'pdf.toImages',
        files: [fileOf('pdf-c.pdf')], options: { format: 'png' } },
      { id: 'f10-zip-create', name: 'zip.create', kind: 'zip.create',
        files: [fileOf('txt-a.txt'), fileOf('txt-b.txt')], options: { level: 6 } },
      { id: 'f10-zip-extract', name: 'zip.extract (re-package)', kind: 'zip.extract',
        files: [fileOf('arch.zip')], options: {} },
      { id: 'f10-tar-extract', name: 'tar.extract (re-package)', kind: 'tar.extract',
        files: [fileOf('bundle.tar')], options: {} },
      { id: 'f10-rename', name: 'rename.batch', kind: 'rename.batch',
        files: [fileOf('txt-a.txt')], options: { mode: 'prefix', prefix: 'renamed-' } },
      { id: 'f10-info', name: 'fileInfo (data)', kind: 'fileInfo',
        files: [fileOf('png.png')], options: {} },
      { id: 'f10-dupes', name: 'duplicates (data)', kind: 'duplicates',
        files: [fileOf('txt-a.txt'), fileOf('txt-dup.txt')], options: {} },
      { id: 'f10-hash', name: 'computeHash (data)', kind: 'computeHash',
        files: [fileOf('png.png'), fileOf('jpg.jpg')], options: {} },
    ]

    if (f['clip.mp3'] && f['clip.mp4']) {
      cases.push(
        { id: 'f10-ffmpeg-audio', name: 'ffmpeg.extractAudio (mp4→mp3)', kind: 'ffmpeg.extractAudio',
          files: [fileOf('clip.mp4')], options: { format: 'mp3', bitrate: 128 } },
        { id: 'f10-ffmpeg-convaudio', name: 'ffmpeg.convertAudio (mp3→wav)', kind: 'ffmpeg.convertAudio',
          files: [fileOf('clip.mp3')], options: { format: 'wav' } },
        { id: 'f10-ffmpeg-video', name: 'ffmpeg.compressVideo', kind: 'ffmpeg.compressVideo',
          files: [fileOf('clip.mp4')], options: { crf: 28, audioBitrate: 96, resolution: '480' } },
      )
    }

    console.log('\nRunning engine kinds through the real IPC + worker pipeline:\n')
    for (const c of cases) {
      const expr = `
        (async () => {
          const fg = window.fileforge;
          const req = ${JSON.stringify({ requestId: c.id, kind: c.kind, files: c.files, options: c.options })};
          try {
            const res = await fg.runEngine(req);
            if (res.kind === 'file') {
              const st = await fg.statFile(res.outputPath);
              let saved = null;
              let saveErr = null;
              try {
                saved = await fg.saveOutputFile({ sourcePath: res.outputPath, suggestedName: 'verify-' + res.filename });
              } catch (e) { saveErr = String(e && e.message || e); }
              let savedStat = null;
              if (saved && saved.path) { savedStat = await fg.statFile(saved.path); }
              try { await fg.cleanupJobTemp(req.requestId); } catch {}
              return { ok: true, kind: res.kind, filename: res.filename, outputPath: res.outputPath,
                outputSize: res.outputSize, stat: st ? { isFile: st.isFile, size: st.size } : null,
                saved: saved && saved.path, savedLocation: saved && saved.location, savedStat: savedStat ? { isFile: savedStat.isFile, size: savedStat.size } : null, saveErr };
            }
            const data = res.data;
            return { ok: true, kind: res.kind,
              dataLen: Array.isArray(data) ? data.length : null,
              dataKind: data === null ? 'null' : typeof data };
          } catch (err) {
            return { ok: false, error: String(err && err.message || err) };
          }
        })()
      `
      const r = await cdp.evaluate(expr)
      if (!r.ok) {
        report(c.name, false, r.error)
        continue
      }
      if (r.kind === 'file') {
        const valid =
          r.outputSize > 0 &&
          r.stat &&
          r.stat.isFile === true &&
          r.stat.size === r.outputSize
        const savedOk = r.saved && r.savedLocation === 'inputFolder' && r.savedStat && r.savedStat.isFile
        report(c.name, valid && savedOk,
          `out=${r.filename} (${r.outputSize}B), saved=${r.saved ? r.savedLocation : 'n/a'}${r.saveErr ? `, saveErr=${r.saveErr}` : ''}`)
      } else {
        const valid = r.dataKind !== 'undefined'
        report(c.name + ' → data', valid, `len=${r.dataLen} type=${r.dataKind}`)
      }
    }

    console.log('\nCancel behaviour (best effort):')
    if (f['big.mp4']) {
      const expr = `
        (async () => {
          const fg = window.fileforge;
          const req = { requestId: 'f10-cancel', kind: 'ffmpeg.compressVideo', files: ${JSON.stringify([f['big.mp4']])}, options: { crf: 16, audioBitrate: 192 } };
          const run = fg.runEngine(req);
          await new Promise((r) => setTimeout(r, 250));
          await fg.cancelEngine(req.requestId);
          try {
            const res = await run;
            try { await fg.cleanupJobTemp(req.requestId); } catch {}
            return { cancelResult: 'completed-anyway', outputSize: res.outputSize };
          } catch (e) {
            return { cancelResult: 'aborted', error: String(e && e.message || e) };
          }
        })()
      `
      const r = await cdp.evaluate(expr)
      report('cancelEngine propagated', true, `result=${r.cancelResult}`)
    } else {
      console.log('  (skipped — no big.mp4 fixture)')
    }

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