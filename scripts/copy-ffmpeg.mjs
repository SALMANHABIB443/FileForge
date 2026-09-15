import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const src = join(process.cwd(), 'node_modules/@ffmpeg/core/dist/umd')
const dest = join(process.cwd(), 'public/ffmpeg')

mkdirSync(dest, { recursive: true })

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm']
for (const f of files) {
  copyFileSync(join(src, f), join(dest, f))
  console.log(`  copied ${f}`)
}
console.log('ffmpeg core copied to public/ffmpeg/')
