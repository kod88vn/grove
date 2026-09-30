'use client'

export function TapSelectWidget({ instance, value, onChange, disabled }) {
  const selectedIds = new Set(value)

  const toggle = (id) => {
    if (disabled) return
    const next = selectedIds.has(id)
      ? value.filter((selectedId) => selectedId !== id)
      : [...value, id]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-slate-700">{instance.prompt}</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Select the clue words">
        {instance.visual.segments.map((segment, index) => {
          if (segment.kind === 'text') return <span key={`text-${index}`}>{segment.text}</span>
          if (segment.kind === 'blank') {
            return (
              <span key={`blank-${index}`}>
                <span aria-hidden="true">____</span>
                <span className="sr-only">blank</span>
              </span>
            )
          }
          const token = instance.visual.tokens.find((entry) => entry.id === segment.id)
          const selected = selectedIds.has(token.id)
          return (
            <button
              key={token.id}
              type="button"
              aria-label={`${token.label}, ${selected ? 'selected' : 'not selected'}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggle(token.id)}
              className={`min-h-[56px] min-w-[56px] rounded border px-3 py-2 ${selected ? 'border-blue-600 bg-blue-100' : 'border-slate-300 bg-white'} disabled:opacity-50`}
            >
              {token.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
