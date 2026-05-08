import { GAME_SLUGS } from '../src/index.js'
import { GAME_META } from '../src/gameCatalog.js'

export default function GamesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-slate-800">Game Arcade</h1>
      <p className="mb-8 text-slate-500">Pick a game and play.</p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {GAME_SLUGS.map((slug) => {
          const meta = GAME_META[slug] || { label: slug, emoji: '🎮' }
          return (
            <li key={slug}>
              <a
                href={`/games/${slug}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition"
              >
                <span className="text-4xl">{meta.emoji}</span>
                <span className="text-sm font-medium text-slate-700">{meta.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
