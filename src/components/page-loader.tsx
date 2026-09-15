export function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 py-24 text-mid-gray"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-ink" />
      <p className="text-[13px]">Loading…</p>
    </div>
  )
}