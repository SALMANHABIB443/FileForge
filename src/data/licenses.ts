export interface LicenseEntry {
  name: string
  version?: string
  license: string
  url: string
  category: 'runtime' | 'dev'
}

export const LICENSES: LicenseEntry[] = [
  {
    name: 'FFmpeg.wasm (core)',
    license: 'GPL-2.0-or-later',
    url: 'https://github.com/ffmpegwasm/ffmpeg.wasm',
    category: 'runtime',
  },
  {
    name: 'FFmpeg.wasm (wrapper)',
    license: 'MIT',
    url: 'https://github.com/ffmpegwasm/ffmpeg.wasm',
    category: 'runtime',
  },
  {
    name: 'pdf-lib',
    license: 'MIT',
    url: 'https://github.com/Hopding/pdf-lib',
    category: 'runtime',
  },
  {
    name: 'pdfjs-dist',
    license: 'Apache-2.0',
    url: 'https://github.com/nicolo-ribaudo/pdfjs-dist',
    category: 'runtime',
  },
  {
    name: 'JSZip',
    license: 'MIT OR GPL-3.0-or-later',
    url: 'https://github.com/Stuk/jszip',
    category: 'runtime',
  },
  {
    name: 'exifreader',
    license: 'MPL-2.0',
    url: 'https://github.com/nicolo-ribaudo/exifreader',
    category: 'runtime',
  },
  {
    name: 'React',
    license: 'MIT',
    url: 'https://github.com/facebook/react',
    category: 'runtime',
  },
  {
    name: 'React Router',
    license: 'MIT',
    url: 'https://github.com/remix-run/react-router',
    category: 'runtime',
  },
  {
    name: 'Zustand',
    license: 'MIT',
    url: 'https://github.com/pmndrs/zustand',
    category: 'runtime',
  },
  {
    name: 'Geist',
    license: 'OFL-1.1',
    url: 'https://vercel.com/font',
    category: 'runtime',
  },
]