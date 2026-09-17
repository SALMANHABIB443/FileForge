import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Navigation } from '@/components/navigation'
import { ErrorBoundary } from '@/components/error-boundary'
import { GlobalJobIndicator } from '@/components/global-job-indicator'
import { PwaManager } from '@/components/pwa-manager'
import { PageLoader } from '@/components/page-loader'
import { InterruptedBanner } from '@/components/interrupted-banner'
import { initQueue } from '@/services/queue'
import { initDesktopNotifications, initUpdateNotifications } from '@/services/desktop-notifications'
import { initUpdater } from '@/services/updater'
import { registerAllTools } from '@/tools'

const Home = lazy(() => import('@/pages/home'))
const Tools = lazy(() => import('@/pages/tools'))
const History = lazy(() => import('@/pages/history'))
const Jobs = lazy(() => import('@/pages/jobs'))
const SettingsPage = lazy(() => import('@/pages/settings'))
const ToolWorkspace = lazy(() => import('@/pages/tool-workspace'))
const NotFoundPage = lazy(() => import('@/pages/not-found'))

registerAllTools()

export default function App() {
  const location = useLocation()
  const isElectron = typeof window !== 'undefined' && Boolean(window.fileforge)

  useEffect(() => {
    void initQueue()
    initUpdater()
    const stopJobToasts = initDesktopNotifications()
    const stopUpdateToasts = initUpdateNotifications()
    return () => {
      stopJobToasts()
      stopUpdateToasts()
    }
  }, [])

  return (
    <ErrorBoundary>
      <button
        type="button"
        onClick={() => document.getElementById('main-content')?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-buttons)] focus:bg-paper focus:px-4 focus:py-2 focus:text-ink focus:ring-2 focus:ring-brown"
      >
        Skip to content
      </button>
      <div className="flex min-h-screen bg-canvas">
        <Navigation />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 md:ml-[270px] min-w-0 px-5 py-8 md:px-9 md:py-9 pb-24 md:pb-9 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] focus:outline-none"
        >
          <div className="max-w-[1200px] mx-auto space-y-8">
            <InterruptedBanner />
            <Suspense fallback={<PageLoader />}>
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/tool/:toolId" element={<ToolWorkspace key={location.pathname} />} />
                <Route path="/history" element={<History />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      <GlobalJobIndicator />
      {!isElectron && <PwaManager />}
    </ErrorBoundary>
  )
}