import { type InputHTMLAttributes, forwardRef } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full bg-surface-alt text-ink placeholder:text-muted rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] font-[family-name:var(--font-geist)] outline-none border border-transparent focus:bg-paper focus:border-hairline transition-colors ${className}`}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'