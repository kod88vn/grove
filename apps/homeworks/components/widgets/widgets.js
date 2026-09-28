'use client'

import { useId, useRef } from 'react'

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
  const promptId = useId()
  return (
    <div className="flex flex-col gap-3">
      <div id={promptId} className="text-slate-700">{instance.prompt}</div>
      <div className="text-xl text-slate-800">{instance.visual.sentence}</div>
      <div role="radiogroup" aria-labelledby={promptId} className="flex flex-col gap-2">
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

function ChoiceWidget({ instance, value, onChange, disabled }) {
  const name = `choice-${instance.seed}-${instance.problemId}`
  const promptId = useId()
  return (
    <div className="flex flex-col gap-3">
      <div id={promptId} className="text-slate-700">{instance.prompt}</div>
      <div role="radiogroup" aria-labelledby={promptId} className="flex flex-col gap-2">
        {instance.visual.options.map((option) => {
          const id = `${name}-${option.id}`
          return (
            <label key={option.id} htmlFor={id} className="flex items-center gap-2 text-slate-700">
              <input
                id={id}
                type="radio"
                name={name}
                value={option.id}
                checked={value === option.id}
                onChange={(event) => {
                  if (disabled) return
                  onChange(event.target.value)
                }}
                disabled={disabled}
                className="h-4 w-4"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </div>
  )
}

function OrderWidget({ instance, value, onChange, disabled }) {
  const promptId = useId()
  const drag = useRef(null)
  const labelOf = (id) => instance.visual.items.find((item) => item.id === id)?.label ?? id

  const move = (from, to) => {
    if (disabled || from === to || from < 0 || to < 0 || from >= value.length || to >= value.length) return
    const next = [...value]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    onChange(next)
  }

  const moveToPointer = (event) => {
    const current = drag.current
    if (disabled || current === null) return
    const rows = [...event.currentTarget.parentElement.querySelectorAll('[data-order-item]')]
    const target = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect()
      return event.clientY >= rect.top && event.clientY < rect.bottom
    })
    if (target < 0) return
    const from = value.indexOf(current.id)
    if (from >= 0 && from !== target) move(from, target)
  }

  return (
    <div className="flex flex-col gap-3">
      <div id={promptId} className="text-slate-700">{instance.prompt}</div>
      <ol data-order-list aria-labelledby={promptId} className="flex flex-col gap-2">
        {value.map((id, index) => (
          <li
            key={id}
            data-order-item={id}
            aria-label={`${labelOf(id)}, position ${index + 1} of ${value.length}`}
            className="flex items-center justify-between gap-2 touch-none rounded border border-slate-300 p-2"
            onPointerDown={(event) => {
              if (disabled) return
              if (event.target.closest('button') !== null) return
              event.currentTarget.setPointerCapture?.(event.pointerId)
              drag.current = { id, startY: event.clientY }
            }}
            onPointerMove={moveToPointer}
            onPointerUp={(event) => {
              if (disabled) return
              event.currentTarget.releasePointerCapture?.(event.pointerId)
              drag.current = null
            }}
            onPointerCancel={(event) => {
              if (disabled) return
              event.currentTarget.releasePointerCapture?.(event.pointerId)
              drag.current = null
            }}
          >
            <span>{labelOf(id)}</span>
            <button
              type="button"
              data-move-up={id}
              disabled={disabled || index === 0}
              aria-label={`Move ${labelOf(id)} up, from position ${index + 1} of ${value.length}`}
              onClick={() => move(index, index - 1)}
            >↑</button>
            <button
              type="button"
              data-move-down={id}
              disabled={disabled || index === value.length - 1}
              aria-label={`Move ${labelOf(id)} down, from position ${index + 1} of ${value.length}`}
              onClick={() => move(index, index + 1)}
            >↓</button>
          </li>
        ))}
      </ol>
    </div>
  )
}

export { NumberWidget, ColumnWidget, FractionWidget, ClozeWidget, ChoiceWidget, OrderWidget }
