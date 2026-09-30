'use client'

const COINS = [
  { value: 25, name: 'quarter', label: 'Quarter' },
  { value: 10, name: 'dime', label: 'Dime' },
  { value: 5, name: 'nickel', label: 'Nickel' },
  { value: 1, name: 'penny', label: 'Penny' },
]

function cents(value) {
  return `${value} cent${value === 1 ? '' : 's'}`
}

function coinName(name, count) {
  if (count === 1) return name
  return name === 'penny' ? 'pennies' : `${name}s`
}

export function CoinsWidget({ instance, value, onChange, disabled }) {
  const denominations = instance.visual.denominations
  const offered = COINS.filter((coin) => denominations.includes(coin.value))
  const counts = value ?? {}

  const changeCount = (coin, amount) => {
    if (disabled) return
    const nextCount = (counts[coin.value] ?? 0) + amount
    const next = { ...counts }
    if (nextCount === 0) delete next[coin.value]
    else next[coin.value] = nextCount
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4" role="group" aria-label="Choose coins">
      <div className="text-slate-700">{instance.prompt}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {offered.map((coin) => {
          const count = counts[coin.value] ?? 0
          return (
            <div key={coin.value} className="flex flex-col items-center gap-2 rounded border border-slate-200 p-3">
              <span className="text-lg font-semibold">{coin.label}</span>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  data-coin-add={coin.value}
                  aria-label={`Add ${coin.name} ${cents(coin.value)}`}
                  disabled={disabled}
                  onClick={() => changeCount(coin, 1)}
                  className="min-h-[56px] min-w-[56px] rounded-full bg-amber-100 px-3 font-semibold disabled:opacity-50"
                >
                  ＋ {coin.label}
                </button>
                <button
                  type="button"
                  data-coin-remove={coin.value}
                  aria-label={`Remove coin worth ${cents(coin.value)} (${coin.name})`}
                  disabled={disabled || count === 0}
                  onClick={() => changeCount(coin, -1)}
                  className="min-h-[56px] min-w-[56px] rounded-full bg-slate-100 px-3 font-semibold disabled:opacity-50"
                >
                  − {coin.label}
                </button>
              </div>
              <div aria-live="polite" role="status" className="text-sm text-slate-600">
                {count === 0 ? 'No coins selected' : `${count} ${coinName(coin.name, count)} selected`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}