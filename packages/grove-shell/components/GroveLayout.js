'use client'

import { NoraWidget } from './NoraWidget.js'

/**
 * GroveLayout — shared shell for all Grove apps.
 *
 * Props:
 *   appName    {string}  Display name shown in the header nav bar.
 *   noraUrl    {string}  Base URL of the Nora app (used by the floating widget).
 *                        Defaults to http://localhost:3000 for local dev.
 *   showNora   {boolean} Whether to render the floating Nora widget. Default true.
 *   children   {ReactNode}
 */
export function GroveLayout({
  appName = 'Grove',
  noraUrl = 'http://localhost:3000',
  showNora = true,
  children,
}) {
  return (
    <div className="grove-shell min-h-screen bg-slate-50">
      <GroveNav appName={appName} noraUrl={noraUrl} />
      <main>{children}</main>
      {showNora && <NoraWidget noraUrl={noraUrl} />}
    </div>
  )
}

function GroveNav({ appName, noraUrl }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Grove</span>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-800">{appName}</span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <a href={noraUrl} className="rounded-md px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">
            Nora
          </a>
        </nav>
      </div>
    </header>
  )
}
