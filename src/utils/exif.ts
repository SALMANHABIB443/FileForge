export interface ImageMetadata {
  make?: string
  model?: string
  dateTaken?: string
  orientation?: string
  width?: number
  height?: number
}

export function extractExifSegment(bytes: Uint8Array): Uint8Array | null {
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break
    const marker = bytes[offset + 1]!
    if (marker === 0xd8) {
      offset += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) break
    const len = (bytes[offset + 2]! << 8) | bytes[offset + 3]!
    if (len < 2 || offset + 2 + len > bytes.length) break
    if (marker === 0xe1) {
      const seg = bytes.subarray(offset, offset + 2 + len)
      const isExif =
        seg[4] === 0x45 && seg[5] === 0x78 && seg[6] === 0x69 && seg[7] === 0x66
      if (isExif) return seg
    }
    offset += 2 + len
  }
  return null
}

export function injectExifSegment(
  outputBytes: Uint8Array,
  exifSegment: Uint8Array,
): Uint8Array {
  if (outputBytes[0] !== 0xff || outputBytes[1] !== 0xd8) return outputBytes
  const body = outputBytes.subarray(2)
  const withExif = new Uint8Array(2 + exifSegment.length + body.length)
  withExif[0] = 0xff
  withExif[1] = 0xd8
  withExif.set(exifSegment, 2)
  withExif.set(body, 2 + exifSegment.length)
  return withExif
}

export function transferExifToJpeg(sourceBytes: Uint8Array, outputBytes: Uint8Array): Uint8Array {
  const segment = extractExifSegment(sourceBytes)
  if (!segment) return outputBytes
  return injectExifSegment(outputBytes, segment)
}

function toMetadata(tags: Record<string, { description: string } | undefined>): ImageMetadata {
  const meta: ImageMetadata = {}
  if (tags.Make?.description) meta.make = String(tags.Make.description)
  if (tags.Model?.description) meta.model = String(tags.Model.description)
  if (tags.DateTimeOriginal?.description) meta.dateTaken = String(tags.DateTimeOriginal.description)
  if (tags.Orientation?.description) meta.orientation = String(tags.Orientation.description)
  if (tags.PixelXDimension?.description) {
    meta.width = Number(tags.PixelXDimension.description)
  }
  if (tags.PixelYDimension?.description) {
    meta.height = Number(tags.PixelYDimension.description)
  }
  return meta
}

export async function readImageMetadata(blob: Blob): Promise<ImageMetadata> {
  const ExifReader = (await import('exifreader')).default
  const buffer = await blob.arrayBuffer()
  const tags = ExifReader.load(buffer, { expanded: false }) as Record<
    string,
    { description: string } | undefined
  >
  return toMetadata(tags)
}