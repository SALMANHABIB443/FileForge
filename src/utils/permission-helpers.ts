export async function requestFileSystemAccess(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window === 'undefined' || !window.showDirectoryPicker) {
    return null
  }
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' })
  } catch {
    return null
  }
}

export async function requestFileSave(
  suggestedName: string,
  mimeType: string,
): Promise<FileSystemFileHandle | null> {
  if (typeof window === 'undefined' || !window.showSaveFilePicker) {
    return null
  }
  try {
    return await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: mimeType, accept: { [mimeType]: [] } }],
    })
  } catch {
    return null
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
