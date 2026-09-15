import { type HTMLAttributes, forwardRef } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement>

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-paper rounded-[var(--radius-cards)] border border-hairline shadow-[var(--shadow-card)] ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'

type CardHeaderProps = HTMLAttributes<HTMLDivElement>

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-5 pt-5 pb-0 ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  },
)

CardHeader.displayName = 'CardHeader'

type CardFooterProps = HTMLAttributes<HTMLDivElement>

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-5 pt-0 pb-5 ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  },
)

CardFooter.displayName = 'CardFooter'