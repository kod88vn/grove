'use client'

export function StepsWidget({ instance, value, onChange, disabled }) {
  const inputPrefix = `answer-${instance.seed}-${instance.problemId}`
  const updateStep = (index, nextValue) => {
    if (disabled) return
    onChange(value.map((step, position) => position === index ? nextValue : step))
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      <div className="text-slate-700">{instance.prompt}</div>
      {instance.visual.items.map(({ id, label }, index) => (
        <label key={id} className="flex flex-col gap-2 font-medium text-slate-800">
          {label} expression
          <input
            id={`${inputPrefix}-${id}`}
            type="text"
            inputMode="text"
            value={value[index]}
            aria-label={`${label} expression`}
            disabled={disabled}
            onChange={(event) => updateStep(index, event.target.value)}
            className="min-h-[56px] w-full min-w-0 rounded border border-slate-300 px-3 py-2 font-mono text-lg text-slate-900 disabled:opacity-50"
          />
        </label>
      ))}
    </div>
  )
}
