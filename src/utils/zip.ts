import type JSZip from 'jszip'

export interface ZipEntry {
  name: string
  blob: Blob | Uint8Array
}

export async function zipBlobs(entries: ZipEntry[]): Promise<Blob> {
  const JSZipModule = (await import('jszip')).default
  const zip: JSZip = new JSZipModule()
  for (const { name, blob } of entries) {
    zip.file(name, blob)
  }
  return zip.generateAsync({ type: 'blob' })
}
