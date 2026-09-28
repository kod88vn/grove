'use client'

function inputId(instance) {
  return `answer-${instance.seed}-${instance.problemId}`
}

function NumberWidget({ instance, value, onChange, disabled }) {
  const id = inputId(instance)
  return (
    <div className="flex flex-col gap-4">
      <div className="text-slate-700">{instance.prompt}</div>
      {!instance.prompt.includes(instance.visual.expression) && (
        <div className="text-xl text-slate-800">{instance.visual.expression}</div>
      )}
      <label htmlFor={id} className="flex flex-col gap-2 text-slate-700">
        Your answer
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            if (!disabled) onChange(event.target.value)
          }}
          disabled={disabled}
          className="rounded border border-slate-300 px-3 py-2"
        />
      </label>
    </div>
  )
}

function ColumnWidget({ instance, value, onChange, disabled }) {
  const id = inputId(instance)
  const { operands, operator } = instance.visual
  return (
    <div className="flex flex-col gap-4">
      <div className="text-slate-700">{instance.prompt}</div>
      <div className="flex flex-col items-end text-xl text-slate-800">
        {operands.map((operand, index) => (
          <div key={`${operand}-${index}`} className="flex w-full justify-end gap-2">
            <span className="w-6 text-left">{index === operands.length - 1 ? operator : ''}</span>
            <span>{operand}</span>
          </div>
        ))}
      </div>
      <label htmlFor={id} className="flex flex-col gap-2 text-slate-700">
        Your answer
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(event) => {
            if (!disabled) onChange(event.target.value)
          }}
          disabled={disabled}
          className="rounded border border-slate-300 px-3 py-2"
        />
      </label>
    </div>
  )
}

function FractionWidget({ instance, value, onChange, disabled }) {
  const id = inputId(instance)
  const expression = instance.visual.addends.map((addend) => `${addend.num}/${addend.den}`).join(` ${instance.visual.operator} `)
  return (
    <div className="flex flex-col gap-4">
      <div className="text-slate-700">{instance.prompt}</div>
      {!instance.prompt.includes(expression) && (
        <div className="text-xl text-slate-800">
          {instance.visual.addends.map((addend, index) => (
            <span key={`${addend.num}-${addend.den}-${index}`}>
              {index > 0 ? ` ${instance.visual.operator} ` : ''}
              {addend.num}/{addend.den}
            </span>
          ))}
        </div>
      )}
      <label htmlFor={id} className="flex flex-col gap-2 text-slate-700">
        Your answer
        <input
          id={id}
          type="text"
          value={value}
          placeholder="e.g. 3/4"
          onChange={(event) => {
            if (!disabled) onChange(event.target.value)
          }}
          disabled={disabled}
          className="rounded border border-slate-300 px-3 py-2"
        />
      </label>
    </div>
  )
}

function ClozeWidget({ instance, value, onChange, disabled }) {
  const name = `choice-${instance.seed}-${instance.problemId}`
  return (
    <div className="flex flex-col gap-3">
      <div className="text-slate-700">{instance.prompt}</div>
      <div className="text-xl text-slate-800">{instance.visual.sentence}</div>
      <div className="flex flex-col gap-2">
        {instance.visual.choices.map((choice, index) => {
          const id = `${name}-${index}`
          return (
            <label key={`${choice}-${index}`} htmlFor={id} className="flex items-center gap-2 text-slate-700">
              <input
                id={id}
                type="radio"
                name={name}
                value={choice}
                checked={value[0] === choice}
                onChange={() => {
                  if (disabled) return
                  const nextValue = [...value]
                  nextValue[0] = choice
                  onChange(nextValue)
                }}
                disabled={disabled}
                className="h-4 w-4"
              />
              {choice}
            </label>
          )
        })}
      </div>
    </div>
  )
}

export { NumberWidget, ColumnWidget, FractionWidget, ClozeWidget }
