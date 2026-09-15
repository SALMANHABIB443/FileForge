import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')
const INK = '#0a0a0a'
const PAPER = '#ffffff'

mkdirSync(outDir, { recursive: true })

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawGlyph(ctx, s, scale) {
  const cx = s / 2
  const cy = s / 2
  const u = s * scale

  ctx.save()
  ctx.translate(cx, cy)

  ctx.fillStyle = PAPER
  const docW = u * 0.44
  const docH = u * 0.62
  const docR = u * 0.055
  const docX = -u * 0.2
  const docY = -docH / 2
  roundedRect(ctx, docX, docY, docW, docH, docR)
  ctx.fill()

  ctx.fillStyle = INK
  const fold = Math.min(docR * 1.4, docW * 0.35)
  ctx.beginPath()
  ctx.moveTo(docX + docW - fold, docY)
  ctx.lineTo(docX + docW, docY + fold)
  ctx.lineTo(docX + docW, docY + fold + docR * 0.3)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = INK
  for (let i = 0; i < 3; i++) {
    const lw = u * 0.12
    const lh = u * 0.035
    const lx = docX + docW * 0.22
    const ly = docY + docH * 0.38 + i * (lh + u * 0.045)
    roundedRect(ctx, lx, ly, lw, lh, lh / 2)
    ctx.fill()
  }

  const ringR = u * 0.19
  const ringX = u * 0.24
  const ringY = u * 0.02
  ctx.strokeStyle = INK
  ctx.lineWidth = u * 0.05
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(ringX, ringY, ringR, Math.PI * 0.25, Math.PI * 1.55)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(ringX + ringR * Math.cos(Math.PI * 0.25), ringY + ringR * Math.sin(Math.PI * 0.25))
  ctx.lineTo(ringX + ringR * 1.32 * Math.cos(Math.PI * 0.45), ringY + ringR * 1.32 * Math.sin(Math.PI * 0.45))
  ctx.lineTo(ringX + ringR * 1.18 * Math.cos(Math.PI * 0.08), ringY + ringR * 1.18 * Math.sin(Math.PI * 0.08))
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

function render(size, scale) {
  const c = createCanvas(size, size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, size, size)
  drawGlyph(ctx, size, scale)
  return c.toBuffer('image/png')
}

const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.5 },
  { file: 'icon-512.png', size: 512, scale: 0.5 },
  { file: 'maskable-192.png', size: 192, scale: 0.62 },
  { file: 'maskable-512.png', size: 512, scale: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.55 },
  { file: 'favicon-32.png', size: 32, scale: 0.6 },
]

for (const t of targets) {
  writeFileSync(resolve(outDir, t.file), render(t.size, t.scale))
  console.log(`wrote ${t.file} (${t.size}x${t.size})`)
}