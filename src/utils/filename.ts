export function generateOutputName(
  originalName: string,
  suffix: string,
  extension: string,
): string {
  const base = originalName.replace(/\.[^.]+$/, '')
  return `${base}_${suffix}.${extension}`
}

export function resolveCollision(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) return name

  const dot = name.lastIndexOf('.')
  const base = dot >= 0 ? name.slice(0, dot) : name
  const ext = dot >= 0 ? name.slice(dot) : ''

  let counter = 1
  let candidate = `${base} (${counter})${ext}`
  while (existingNames.has(candidate)) {
    counter++
    candidate = `${base} (${counter})${ext}`
  }
  return candidate
}

export function sanitizeFilename(name: string): string {
  return name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]! ?? 'TB'}`
}

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function formatSizeComparison(inputBytes: number, outputBytes: number): string {
  const input = formatFileSize(inputBytes)
  const output = formatFileSize(outputBytes)
  if (inputBytes === 0) return `${input} → ${output}`
  const change = ((outputBytes - inputBytes) / inputBytes) * 100
  const delta = Math.abs(change)
  if (delta < 1) return `${input} → ${output} · about the same size`
  if (outputBytes > inputBytes) {
    return `${input} → ${output} · ${delta.toFixed(0)}% larger`
  }
  return `${input} → ${output} · ${delta.toFixed(0)}% smaller`
}
