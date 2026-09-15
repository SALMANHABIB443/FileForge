import { type HTMLAttributes, forwardRef } from 'react'

type BadgeVariant = 'solid' | 'soft' | 'outline' | 'success'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  solid: 'bg-brown text-paper',
  soft: 'bg-brown-light text-brown-dark',
  outline: 'bg-transparent text-ink border border-hairline',
  success: 'bg-success-bg text-success-text',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'solid', className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`inline-flex items-center rounded-[var(--radius-buttons)] px-3 py-1 text-[12px] font-semibold font-[family-name:var(--font-geist)] ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    )
  },
)

Badge.displayName = 'Badge'