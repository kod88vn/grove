'use client'

export function NumberLineWidget({ instance, value, onChange, disabled }) {
  const { segments } = instance.visual

  const select = (index) => {
    if (!disabled) onChange(index)
  }

  const position = (index) => `${index * 100 / segments}%`
  const axisHeight = 76
  const trackWidth = `${segments * 44}px`
  const tickTop = 10
  const markTop = 9
  const hasSelection = Number.isInteger(value) && value >= 0 && value <= segments

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      <div className="text-slate-700">{instance.prompt}</div>
      <div className="relative flex min-w-0 flex-col gap-2 px-5" role="group" aria-label="Number line">
        <div className="min-w-0 max-w-full overflow-x-auto" style={{ paddingInline: 22 }}>
          <div className="relative w-full" style={{ minWidth: trackWidth }}>
            <div className="relative" style={{ height: axisHeight }}>
              <div
                data-number-line-axis
                aria-hidden="true"
                className="absolute inset-0 rounded bg-slate-700"
                style={{ clipPath: `inset(32px 0 ${axisHeight - 36}px 0)` }}
              />
              {Array.from({ length: segments + 1 }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Mark ${index} of ${segments}`}
                  aria-pressed={value === index}
                  disabled={disabled}
                  onClick={() => select(index)}
                  data-number-line-tick
                  style={{ left: position(index), top: tickTop }}
                  className="absolute h-11 min-h-11 w-11 min-w-11 -translate-x-1/2 rounded border-0 bg-transparent p-0 text-transparent hover:bg-blue-50 disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 h-7 w-1 -translate-x-1/2 rounded bg-slate-700"
                    style={{ top: markTop }}
                  />
                </button>
              ))}
              {hasSelection && (
                <span
                  data-number-line-selected
                  aria-hidden="true"
                  style={{ left: position(value), top: tickTop + markTop }}
                  className="pointer-events-none absolute h-7 w-3 -translate-x-1/2 rounded-full border-2 border-blue-700 bg-blue-400"
                />
              )}
            </div>
            <div className="relative h-6 text-slate-700">
              <span data-number-line-endpoint style={{ left: '0%' }} className="absolute -translate-x-1/2">0</span>
              <span data-number-line-endpoint style={{ left: '100%' }} className="absolute -translate-x-1/2">1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}