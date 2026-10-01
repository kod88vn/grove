'use client'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

export function keysFor(widget) {
  if (widget === 'fraction') return [...DIGITS, '/']
  if (widget === 'number' || widget === 'column') return DIGITS
  if (widget === 'expression') return [...DIGITS, 'x', '+', '-', '*', '/', '^', '(', ')']
  return null
}

export function MathKeypad({ widget, value, onChange, disabled }) {
  const keys = keysFor(widget)
  if (keys === null) return null

  const buttonClassName = 'min-h-[56px] min-w-[56px] rounded bg-slate-100 px-4 py-2 text-xl font-semibold'
  const update = (nextValue) => {
    if (!disabled) onChange(nextValue)
  }

  return (
    <div role="group" aria-label={widget === 'expression' ? 'Expression pad' : 'Number pad'} className="grid grid-cols-5 gap-2">
      {keys.map((character) => (
        <button
          key={character}
          type="button"
          aria-label={character === '/' ? 'Fraction bar' : undefined}
          disabled={disabled}
          className={buttonClassName}
          onClick={() => update(value + character)}
        >
          {character}
        </button>
      ))}
      <button
        type="button"
        aria-label="Delete last"
        disabled={disabled}
        className={buttonClassName}
        onClick={() => update(value.slice(0, -1))}
      >
        ⌫
      </button>
      <button
        type="button"
        aria-label="Clear answer"
        disabled={disabled}
        className={buttonClassName}
        onClick={() => update('')}
      >
        Clear
      </button>
    </div>
  )
}
