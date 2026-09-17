import { createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')
const source = resolve(outDir, 'app-icon.png')
const BACKGROUND = '#FAF5EF'

mkdirSync(outDir, { recursive: true })
mkdirSync(resolve(root, 'build'), { recursive: true })

async function render(size, { padBg = false } = {}) {
  const img = await loadImage(source)
  const c = createCanvas(size, size)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (padBg) {
    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, size, size)
  }
  ctx.drawImage(img, 0, 0, size, size)
  return c.toBuffer('image/png')
}

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-192.png', size: 192, padBg: true },
  { file: 'maskable-512.png', size: 512, padBg: true },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
]

for (const t of targets) {
  if (t.file === source) continue
  writeFileSync(resolve(outDir, t.file), await render(t.size, { padBg: t.padBg }))
  console.log(`wrote ${t.file} (${t.size}x${t.size})`)
}

// Generate Windows .ico file with multiple sizes packed into a single icon.
function packICO(pngBuffers) {
  const count = pngBuffers.length
  const headerSize = 6 + count * 16
  const dirEntries = []
  let dataOffset = headerSize

  for (const { size, png } of pngBuffers) {
    const entry = Buffer.alloc(16)
    // ICO spec: 0 means >= 256 (or 0 for special cases)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(dataOffset, 12)
    dirEntries.push(entry)
    dataOffset += png.length
  }

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)
  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map((b) => b.png)])
}

const icoSizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
const icoPngs = []
for (const s of icoSizes) icoPngs.push({ size: s, png: await render(s) })
const icoData = packICO(icoPngs)
writeFileSync(resolve(root, 'build/icon.ico'), icoData)
console.log(`wrote icon.ico (${icoData.length} bytes, ${icoSizes.length} sizes)`)

// Emit favicon.svg embedding the 64x64 raster so index.html + PWA references keep working.
async function renderFaviconSvg() {
  const png = await render(64)
  const b64 = png.toString('base64')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${b64}"/></svg>\n`
}
writeFileSync(resolve(root, 'public/favicon.svg'), await renderFaviconSvg())
console.log('wrote favicon.svg (raster-embedded 64x64)')