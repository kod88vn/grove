const APPS = [
  {
    href: '/chat',
    label: 'Nora',
    emoji: '🤖',
    description: 'Your AI family assistant. Ask anything.',
    accent: 'border-indigo-200 hover:border-indigo-400',
    badge: 'bg-indigo-50 text-indigo-700',
  },
  {
    href: '/games',
    label: 'Games',
    emoji: '🎮',
    description: 'Educational games for curious kids.',
    accent: 'border-emerald-200 hover:border-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  {
    href: '/shopping-list',
    label: 'Shopping List',
    emoji: '🛒',
    description: 'Shared grocery and household lists.',
    accent: 'border-amber-200 hover:border-amber-400',
    badge: 'bg-amber-50 text-amber-700',
  },
  {
    href: '/reminders',
    label: 'Reminders',
    emoji: '🔔',
    description: 'Chores, school tasks, and routines.',
    accent: 'border-rose-200 hover:border-rose-400',
    badge: 'bg-rose-50 text-rose-700',
  },
]

export default function LandingPage() {
  return (
    <main className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Grove</h1>
          <p className="mt-3 text-base text-slate-500">Your family&apos;s home hub. Pick an app to get started.</p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {APPS.map(({ href, label, emoji, description, accent, badge }) => (
            <li key={href}>
              <a
                href={href}
                className={`flex flex-col gap-3 rounded-2xl border-2 bg-white p-6 shadow-sm transition hover:shadow-md ${accent}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{emoji}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>{label}</span>
                </div>
                <p className="text-sm leading-6 text-slate-600">{description}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
