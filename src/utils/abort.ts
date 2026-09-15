export function checkAbort(signal?: AbortSignal): void {
  if (signal && signal.aborted) {
    throw new DOMException('Operation cancelled', 'AbortError')
  }
}
