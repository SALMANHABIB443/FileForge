import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const results = []
let failures = 0

function report(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures++
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`)
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8'))
}

function parseYmlFlat(rel) {
  const text = fs.readFileSync(path.join(root, rel), 'utf-8')
  const out = { raw: text }
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_.]+):\s*(.*)$/.exec(line.trim())
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

function main() {
  const pkg = readJson('package.json')

  console.log('Phase 15 — Production Release artifacts & packaging config\n')

  // ── Version ────────────────────────────────────────────────────────────────
  const version = String(pkg.version ?? '')
  const semver = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)
  report('package.json version is a valid semver', semver, `version=${version}`)
  report('version is not a pre-release (0.x) dev version', /^(0|[1-9]\d*)\./.test(version) && !version.includes('-'), `version=${version}`)
  const lock = readJson('package-lock.json')
  report('package-lock.json version matches package.json', lock.version === version, `lock=${lock.version}`)

  // ── electron-builder configuration ─────────────────────────────────────────
  const build = pkg.build ?? {}
  report('electron-builder build config present', !!build && typeof build === 'object')
  report('productName is FileForge', build.productName === 'FileForge', `productName=${build.productName}`)
  report('appId is com.fileforge.app', build.appId === 'com.fileforge.app', `appId=${build.appId}`)
  report('compression is maximum', build.compression === 'maximum', build.compression ?? 'unset')
  report('releaseInfo.releaseNotes set (feeds latest.yml)', typeof build.releaseInfo?.releaseNotes === 'string' && build.releaseInfo.releaseNotes.length > 0)

  const pub = build.publish ?? {}
  report(
    'publish provider is GitHub (owner/repo)',
    pub.provider === 'github' && typeof pub.owner === 'string' && typeof pub.repo === 'string',
    `${pub.provider ?? 'none'} ${pub.owner ?? ''}/${pub.repo ?? ''}`,
  )

  const win = build.win ?? {}
  report('win.target includes nsis', Array.isArray(win.target) && win.target.includes('nsis'), String(win.target))
  report(
    'artifactName is FileForge-Setup-${version}.${ext}',
    win.artifactName === 'FileForge-Setup-${version}.${ext}',
    win.artifactName ?? 'unset',
  )

  const nsis = build.nsis ?? {}
  report('nsis.oneClick is false (assisted installer)', nsis.oneClick === false)
  report('nsis allows install dir selection', nsis.allowToChangeInstallationDirectory === true)
  report('nsis creates Start Menu + optional Desktop shortcut', nsis.createStartMenuShortcut === true && nsis.createDesktopShortcut === true)
  report('nsis shortcut name is FileForge', nsis.shortcutName === 'FileForge', nsis.shortcutName ?? 'unset')
  report(
    'nsis installer/uninstaller icons reference build/icon.ico',
    typeof nsis.installerIcon === 'string' && typeof nsis.uninstallerIcon === 'string',
  )

  // ── Icon ───────────────────────────────────────────────────────────────────
  const icoPath = path.join(root, 'build', 'icon.ico')
  let icoSizes = 0
  if (fs.existsSync(icoPath)) {
    const buf = fs.readFileSync(icoPath)
    const isIco = buf.length >= 6 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1
    icoSizes = isIco ? buf.readUInt16LE(4) : 0
    report('build/icon.ico exists and is a valid ICO', isIco, `${buf.length} bytes`)
    report('build/icon.ico packs multiple sizes', isIco && icoSizes > 1, `${icoSizes} sizes`)
  } else {
    report('build/icon.ico exists and is a valid ICO', false, 'missing — run scripts/generate-icons.mjs')
  }
  report('win.icon points at build/icon.ico', win.icon === 'build/icon.ico', win.icon ?? 'unset')

  // ── npm scripts ────────────────────────────────────────────────────────────
  const scripts = pkg.scripts ?? {}
  report('package:dir script exists (unpacked smoke build)', typeof scripts['package:dir'] === 'string')
  report('package:electron script exists (installer build)', typeof scripts['package:electron'] === 'string')
  report('release script exists (publish to GitHub Releases)', typeof scripts['release'] === 'string')
  report('verify:electron:phase15 script exists', typeof scripts['verify:electron:phase15'] === 'string')

  // ── release artifacts ──────────────────────────────────────────────────────
  const releaseDir = path.join(root, 'release')
  if (!fs.existsSync(releaseDir)) {
    report('release/ contains packaged artifacts', false, 'missing — run npm run package:electron')
  } else {
    const entries = fs.readdirSync(releaseDir)
    const installerMatch = new RegExp(`^FileForge-Setup-${version.replace(/\./g, '\\.')}(-setup)?\\.exe$`)
    const installer = entries.find((f) => installerMatch.test(f))
    report(
      'installer artifact exists',
      !!installer,
      installer !== undefined ? installer : (entries.filter((f) => f.endsWith('.exe')).join(', ') || 'none'),
    )
    report('latest.yml exists (auto-update metadata)', fs.existsSync(path.join(releaseDir, 'latest.yml')))

    const blockmaps = entries.filter((f) => f.endsWith('.blockmap'))
    report('differential blockmap exists for installer', blockmaps.length > 0, blockmaps.join(', '))

    if (fs.existsSync(path.join(releaseDir, 'latest.yml'))) {
      const yml = parseYmlFlat('release/latest.yml')
      report('latest.yml version matches package.json', yml.version === version, `latest.yml=${yml.version}`)
      const mentionsInstaller = installer ? yml.raw.includes(installer) : false
      report('latest.yml references the built installer asset', mentionsInstaller)
      report('latest.yml includes sha512 + releaseDate', typeof yml.sha512 === 'string' && yml.sha512.length > 0 && typeof yml.releaseDate === 'string')
    }

    const unpacked = path.join(releaseDir, 'win-unpacked')
    if (fs.existsSync(unpacked)) {
      const appUpdateYml = path.join(unpacked, 'resources', 'app-update.yml')
      report('packaged app contains resources/app-update.yml', fs.existsSync(appUpdateYml))
      const exe = entries.find((f) => f === 'FileForge.exe') || fs.readdirSync(unpacked).find((f) => f.endsWith('.exe'))
      report('win-unpacked contains the app executable', !!exe, exe ?? 'missing')
      const ffmpeg = path.join(unpacked, 'resources', 'ffmpeg', 'ffmpeg.exe')
      report('ffmpeg runtime bundled in resources/ffmpeg', fs.existsSync(ffmpeg))
    } else {
      report('win-unpacked dir present (packaged app for smoke testing)', false, 'not found in release/')
    }
  }

  const outDir = path.join(root, 'out')
  const rendererOk = fs.existsSync(path.join(root, 'out', 'renderer', 'index.html'))
  if (!fs.existsSync(outDir) || !rendererOk) {
    report('electron build output present (out/)', false, 'missing — run npm run build:electron first')
  } else {
    report('electron build output present (out/)', true, 'main + preload + renderer')
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Verification complete: ${results.filter((r) => r.ok).length}/${results.length} passed`)
  process.exit(failures === 0 ? 0 : 1)
}

main()