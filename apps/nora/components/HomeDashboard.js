import Link from 'next/link'
import { WeatherWidget } from '@/components/WeatherWidget'

export function HomeDashboard({ data }) {
  return (
    <main
      className="min-h-screen px-4 py-6 md:px-6 md:py-8"
      style={{ background: 'linear-gradient(160deg, #f0f7ee 0%, #faf9f6 45%, #f5f0e8 100%)' }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">

        {/* Hero */}
        <section className="overflow-hidden rounded-3xl border border-green-100 bg-white p-6 shadow-sm md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.45fr,0.95fr]">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-800 text-sm font-bold text-white shadow-sm">
                  {data.user.initials}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-green-700">Grove · Family dashboard</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
                    {data.greeting}, {data.user.name}
                  </h1>
                </div>
              </div>

              <p className="max-w-2xl text-base leading-7 text-stone-500 md:text-lg">{data.headline}</p>

              {data.profile.interests.length ? (
                <div className="flex flex-wrap gap-2">
                  {data.profile.interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-800"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {data.quickActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="inline-flex items-center justify-center rounded-xl bg-green-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-700"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Panel title="Weather" eyebrow="Live forecast" accent="sky">
                <WeatherWidget initialData={data.weather} />
              </Panel>

              <Panel title="Household interests" eyebrow="From recent chats" accent="amber">
                <p className="text-sm leading-6 text-stone-500">{data.profile.summary}</p>
                <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">
                  {data.profile.sourceCount} chats sampled
                </p>
              </Panel>
            </div>
          </div>
        </section>

        {/* Main grid */}
        <section className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-5">
            <Panel title="Personal brief" eyebrow="From recent family activity" accent="green">
              {data.brief.length ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {data.brief.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{item.tag}</p>
                      <h2 className="mt-2 text-base font-semibold text-stone-900">{item.title}</h2>
                      <p className="mt-1.5 text-sm leading-6 text-stone-500">{item.summary}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>
                  Nora needs a little real chat history before this brief can summarize what matters to your family.
                </EmptyState>
              )}
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Shopping list" eyebrow="Household prep" accent="green">
                {data.shoppingList.length ? (
                  <ul className="space-y-2">
                    {data.shoppingList.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 px-3 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{item.label}</p>
                          <p className="text-sm text-stone-400">{item.detail}</p>
                        </div>
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" aria-hidden="true" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>No shopping items yet.</EmptyState>
                )}
                <Link href="/modules/shopping-list" className="mt-4 inline-flex text-sm font-medium text-green-700 hover:text-green-900">
                  Open shopping list →
                </Link>
              </Panel>

              <Panel title="Reminders" eyebrow="Today and next up" accent="amber">
                {data.reminders.length ? (
                  <ul className="space-y-2">
                    {data.reminders.map((item) => (
                      <li key={item.id} className="rounded-xl border border-stone-100 px-3 py-2.5">
                        <p className="text-sm font-semibold text-stone-900">{item.title}</p>
                        <p className="mt-0.5 text-sm text-stone-400">{item.dueLabel}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>No reminders yet.</EmptyState>
                )}
                <Link href="/modules/reminders" className="mt-4 inline-flex text-sm font-medium text-amber-700 hover:text-amber-900">
                  Open reminders →
                </Link>
              </Panel>
            </div>
          </div>

          <Panel title="Nora suggests" eyebrow="Quick actions" accent="green">
            <div className="space-y-3">
              <div
                className="rounded-2xl p-5 text-white"
                style={{ background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)' }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green-200">Try asking</p>
                <p className="mt-2.5 text-sm leading-6">
                  Build me a dinner plan from tonight&apos;s shopping list and remind me what has to happen before bedtime.
                </p>
              </div>
              <div className="grid gap-2">
                <ActionItem label="Generate dinner plan" description="Shopping list · today's schedule" href="/chat" />
                <ActionItem label="Brief → reminders" description="Turn the brief into an action list" href="/chat" />
                <ActionItem label="Explore modules" description="Utilities and household tools" href="/modules" />
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  )
}

function Panel({ title, eyebrow, accent, children }) {
  const dot = {
    green: 'bg-green-500',
    sky: 'bg-sky-400',
    amber: 'bg-amber-400',
  }

  return (
    <section className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dot[accent] ?? 'bg-stone-300'}`} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{eyebrow}</p>
      </div>
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ActionItem({ label, description, href }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-stone-100 px-4 py-3 transition hover:border-green-200 hover:bg-green-50 group"
    >
      <div>
        <p className="text-sm font-semibold text-stone-900">{label}</p>
        <p className="mt-0.5 text-xs text-stone-400">{description}</p>
      </div>
      <span className="text-stone-300 transition group-hover:text-green-600">→</span>
    </Link>
  )
}

function EmptyState({ children }) {
  return (
    <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-400">
      {children}
    </p>
  )
}
