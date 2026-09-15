import { Component, createRef, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { logger } from '@/services/logger'
import { APP_VERSION } from '@/version'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  private headingRef = createRef<HTMLHeadingElement>()

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const detail = `[name=${error.name}] [message=${error.message}] [componentStack=${errorInfo.componentStack}]`
    logger.recordCrash('uncaught UI error', detail, { version: APP_VERSION, userAgent: navigator.userAgent })
  }

  componentDidUpdate(_prevProps: Props, prevState: State): void {
    if (!prevState.hasError && this.state.hasError) {
      this.headingRef.current?.focus()
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-canvas p-8">
          <div
            role="alert"
            className="bg-paper rounded-[18px] border border-hairline shadow-[var(--shadow-card)] p-10 max-w-md text-center"
          >
            <h2
              ref={this.headingRef}
              tabIndex={-1}
              className="text-[24px] leading-[1.33] tracking-[-0.6px] font-semibold text-ink mb-2 font-[family-name:var(--font-geist)]"
            >
              Something went wrong
            </h2>
            <p className="text-[14px] leading-[1.43] text-mid-gray mb-6 font-[family-name:var(--font-geist)]">
              An unexpected error occurred. Your files are safe.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-[12px] text-mid-gray bg-canvas rounded-[12px] p-3 mb-6 text-left overflow-auto max-h-40 font-[family-name:var(--font-geist)]">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={this.handleReset}>Try again</Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
