'use client'

export function FractionBarWidget({ instance, value, onChange, disabled }) {
  const shaded = new Set(value)
  const toggle = (index) => {
    if (disabled) return
    const next = shaded.has(index) ? value.filter((entry) => entry !== index) : [...value, index]
    onChange(next)
  }

  const bar = (indices, label, interactive) => (
    <div role="group" aria-label={label} className="flex flex-nowrap gap-1 overflow-x-auto">
      {indices.map((index) => {
        const isShaded = interactive ? shaded.has(index) : index < instance.visual.reference.num
        return interactive ? (
          <button
            key={index}
            type="button"
            aria-label={`Segment ${index + 1}, ${isShaded ? 'shaded' : 'not shaded'}`}
            aria-pressed={isShaded}
            disabled={disabled}
            onClick={() => toggle(index)}
            className={`h-12 min-w-8 flex-1 rounded border ${isShaded ? 'border-blue-600 bg-blue-300' : 'border-slate-300 bg-white'} disabled:opacity-50`}
          />
        ) : (
          <span
            key={index}
            aria-hidden="true"
            data-shaded={isShaded}
            className={`h-12 min-w-8 flex-1 rounded border ${isShaded ? 'border-blue-600 bg-blue-300' : 'border-slate-300 bg-white'}`}
          />
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="text-slate-700">{instance.prompt}</div>
      <div role="group" aria-label="Reference bar" className="flex flex-col gap-2">
        <span className="text-slate-700">Reference {instance.visual.reference.num}/{instance.visual.reference.den}</span>
        {bar(Array.from({ length: instance.visual.reference.den }, (_, index) => index), 'Reference segments', false)}
      </div>
      <div className="flex flex-col gap-2">
        <span data-fraction-bar-count className="text-slate-700">Shaded {value.length} of {instance.visual.segments}</span>
        {bar(Array.from({ length: instance.visual.segments }, (_, index) => index), 'Answer bar', true)}
      </div>
    </div>
  )
}