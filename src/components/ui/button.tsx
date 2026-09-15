import { type ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brown text-paper shadow-[var(--shadow-card)] hover:bg-brown-dark hover:shadow-[var(--shadow-card-hover)]',
  secondary:
    'bg-surface-alt text-brown-dark hover:bg-brown-light',
  outline:
    'bg-transparent text-ink border border-hairline hover:bg-brown-hover',
  destructive:
    'bg-transparent text-ember hover:bg-ember/5',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-[42px] px-5 text-[14px]',
  lg: 'h-[46px] px-6 text-[15px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-buttons)] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none font-[family-name:var(--font-geist)] ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'