import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        role="alert"
        className="bg-paper rounded-[18px] border border-hairline shadow-[var(--shadow-card)] p-10 max-w-md text-center"
      >
        <p className="text-[14px] font-medium text-mid-gray font-[family-name:var(--font-geist)]">404</p>
        <h1 className="text-[24px] leading-[1.33] tracking-[-0.6px] font-semibold text-ink mb-2 mt-1 font-[family-name:var(--font-geist)]">
          Page not found
        </h1>
        <p className="text-[14px] leading-[1.43] text-mid-gray mb-6 font-[family-name:var(--font-geist)]">
          The page you're looking for doesn't exist. Your files are safe.
        </p>
        <Link to="/" className="inline-block">
          <Button>Back to Home</Button>
        </Link>
      </div>
    </div>
  )
}