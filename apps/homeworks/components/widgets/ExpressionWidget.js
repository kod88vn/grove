'use client'

export function ExpressionWidget({ instance, value, onChange, disabled }) {
  const inputId = `answer-${instance.seed}-${instance.problemId}`
  const updateExpression = (event) => {
    if (disabled) return
    onChange(event.target.value)
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      <div className="text-slate-700">{instance.prompt}</div>
      <label className="flex flex-col gap-2 font-medium text-slate-800">
        Expression
        <input
          id={inputId}
          type="text"
          inputMode="text"
          value={value}
          aria-label="Expression"
          disabled={disabled}
          onChange={updateExpression}
          className="min-h-[56px] w-full min-w-0 rounded border border-slate-300 px-3 py-2 font-mono text-lg text-slate-900 disabled:opacity-50"
        />
      </label>
    </div>
  )
}
