export function GardenDecorations({ summary, error, busy, onBuy }) {
  const owned = summary.decorations?.owned ?? []
  return (
    <section aria-label="Garden decorations">
      <h2 className="mt-7 text-2xl font-bold">Garden decorations</h2>
      {error && <p role="alert" className="mt-2 text-rose-700">{error}</p>}
      <p className="mt-1">☀️ {summary.rewards.sunshine} Sunshine available</p>
      {owned.length > 0 && <ul aria-label="Owned decorations" className="mt-3 flex flex-wrap gap-2">{owned.map((item) => <li className="rounded-xl bg-amber-100 p-3 font-semibold" key={item.id}>Your {item.name}</li>)}</ul>}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">{(summary.decorations?.catalog ?? []).map((item) => {
        const isOwned = owned.some((entry) => entry.id === item.id)
        return <li key={item.id} className="rounded-xl border p-4"><p className="font-bold">{item.name}</p><p>☀️ {item.price}</p><button type="button" aria-label={isOwned ? `${item.name} owned` : `Buy ${item.name} decoration`} disabled={busy || isOwned || summary.rewards.sunshine < item.price} onClick={() => onBuy(item.id)} className="mt-2 min-h-14 rounded-xl bg-amber-300 px-4 font-bold disabled:opacity-60">{isOwned ? 'Owned' : 'Buy decoration'}</button></li>
      })}</ul>
    </section>
  )
}
