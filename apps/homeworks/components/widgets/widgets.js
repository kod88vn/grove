'use client'

import { useId, useRef } from 'react'

import { CoinsWidget } from './CoinsWidget'
import { TapSelectWidget } from './TapSelectWidget'

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

function TextWidget({ instance, value, onChange, disabled }) {
  const id = inputId(instance)
  return (
    <div className="flex flex-col gap-4">
      <div className="text-slate-700">{instance.prompt}</div>
      <label htmlFor={id} className="flex flex-col gap-2 text-slate-700">
        Your answer
        <input
          id={id}
          type="text"
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

function SortWidget({ instance, value, onChange, disabled }) {
  const promptId = useId()
  const root = useRef(null)
  const drag = useRef(null)
  const { items, buckets } = instance.visual

  const labelOf = (itemId) => items.find((item) => item.id === itemId)?.label ?? itemId
  const bucketLabelOf = (bucketId) => buckets.find((bucket) => bucket.id === bucketId)?.label ?? bucketId

  const place = (itemId, bucketId) => {
    if (disabled) return
    const index = items.findIndex((item) => item.id === itemId)
    if (index < 0) return
    const next = [...value]
    next[index] = bucketId
    onChange(next)
  }

  const dropAt = (event) => {
    const itemId = drag.current
    if (disabled || itemId === null || root.current === null) return
    const regions = [...root.current.querySelectorAll('[data-sort-tray], [data-sort-bucket]')]
    const region = regions.find((entry) => {
      const rect = entry.getBoundingClientRect()
      return event.clientX >= rect.left && event.clientX < rect.right
        && event.clientY >= rect.top && event.clientY < rect.bottom
    })
    if (region !== undefined) place(itemId, region.dataset.sortBucket ?? null)
  }

  const regionFor = (bucketId) => (
    <div
      key={bucketId ?? 'tray'}
      {...(bucketId === null ? { 'data-sort-tray': true } : { 'data-sort-bucket': bucketId })}
      role="region"
      aria-label={bucketId === null ? 'Cards waiting to be sorted' : `Bucket ${bucketLabelOf(bucketId)}`}
      className="flex min-h-24 flex-wrap gap-2 rounded border border-dashed border-slate-300 p-2"
    >
      {items.map((item, index) => {
        if (value[index] !== bucketId) return null
        const itemLabel = labelOf(item.id)
        const sitting = bucketId === null ? 'in the tray' : `in ${bucketLabelOf(bucketId)}`
        return (
          <div
            key={item.id}
            data-sort-item={item.id}
            aria-label={`${itemLabel}, ${sitting}`}
            className="flex flex-col gap-2 rounded border border-slate-300 p-2 touch-none"
            onPointerDown={(event) => {
              if (disabled) return
              if (event.target.closest('button') !== null) return
              event.currentTarget.setPointerCapture?.(event.pointerId)
              drag.current = item.id
            }}
            onPointerUp={(event) => {
              if (disabled) return
              event.currentTarget.releasePointerCapture?.(event.pointerId)
              dropAt(event)
              drag.current = null
            }}
            onPointerCancel={(event) => {
              if (disabled) return
              event.currentTarget.releasePointerCapture?.(event.pointerId)
              drag.current = null
            }}
          >
            <span>{itemLabel}</span>
            <div className="flex flex-wrap gap-1">
              {buckets.map((bucket) => (
                <button
                  key={bucket.id}
                  type="button"
                  data-sort-place-item={item.id}
                  data-sort-place-bucket={bucket.id}
                  disabled={disabled || value[index] === bucket.id}
                  aria-label={`Place ${itemLabel} in ${bucket.label}`}
                  onClick={() => place(item.id, bucket.id)}
                >
                  {bucket.label}
                </button>
              ))}
              <button
                type="button"
                data-sort-return-item={item.id}
                disabled={disabled || value[index] === null}
                aria-label={`Return ${itemLabel} to the tray`}
                onClick={() => place(item.id, null)}
              >
                Return to tray
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div ref={root} className="flex flex-col gap-3" aria-labelledby={promptId}>
      <div id={promptId} className="text-slate-700">{instance.prompt}</div>
      {regionFor(null)}
      {buckets.map((bucket) => regionFor(bucket.id))}
    </div>
  )
}

function MatchWidget({ instance, value, onChange, disabled }) {
  const promptId = useId()
  const root = useRef(null)
  const drag = useRef(null)
  const { left, right } = instance.visual

  const leftLabelOf = (leftId) => left.find((item) => item.id === leftId)?.label ?? leftId
  const rightLabelOf = (rightId) => right.find((item) => item.id === rightId)?.label ?? rightId

  const place = (rightId, leftId) => {
    if (disabled) return
    const cardIndex = right.findIndex((card) => card.id === rightId)
    if (cardIndex < 0) return
    const next = [...value]
    const sittingIndex = next.findIndex((entry) => entry === leftId)
    if (sittingIndex >= 0 && sittingIndex !== cardIndex) next[sittingIndex] = null
    next[cardIndex] = leftId
    onChange(next)
  }

  const dropAt = (event) => {
    const rightId = drag.current
    if (disabled || rightId === null || root.current === null) return
    const regions = [...root.current.querySelectorAll('[data-match-tray], [data-match-slot]')]
    const region = regions.find((entry) => {
      const rect = entry.getBoundingClientRect()
      return event.clientX >= rect.left && event.clientX < rect.right
        && event.clientY >= rect.top && event.clientY < rect.bottom
    })
    if (region !== undefined) place(rightId, region.dataset.matchSlot ?? null)
  }

  const regionFor = (leftId) => (
    <div
      key={leftId ?? 'tray'}
      {...(leftId === null ? { 'data-match-tray': true } : { 'data-match-slot': leftId })}
      role="region"
      aria-label={leftId === null ? 'Cards waiting to be matched' : `Match slot ${leftLabelOf(leftId)}`}
      className="flex min-h-24 flex-wrap gap-2 rounded border border-dashed border-slate-300 p-2"
    >
      {leftId !== null && <span>{leftLabelOf(leftId)}</span>}
      {right.map((card, index) => {
        if (value[index] !== leftId) return null
        const cardLabel = rightLabelOf(card.id)
        const sitting = leftId === null ? 'in the tray' : `with ${leftLabelOf(leftId)}`
        return (
          <div
            key={card.id}
            data-match-card={card.id}
            aria-label={`${cardLabel}, ${sitting}`}
            className="flex flex-col gap-2 rounded border border-slate-300 p-2 touch-none"
            onPointerDown={(event) => {
              if (disabled) return
              if (event.target.closest('button') !== null) return
              event.currentTarget.setPointerCapture?.(event.pointerId)
              drag.current = card.id
            }}
            onPointerUp={(event) => {
              if (disabled) return
              event.currentTarget.releasePointerCapture?.(event.pointerId)
              dropAt(event)
              drag.current = null
            }}
            onPointerCancel={(event) => {
              if (disabled) return
              event.currentTarget.releasePointerCapture?.(event.pointerId)
              drag.current = null
            }}
          >
            <span>{cardLabel}</span>
            <div className="flex flex-wrap gap-1">
              {left.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-match-pair-card={card.id}
                  data-match-pair-slot={item.id}
                  disabled={disabled || value[index] === item.id}
                  aria-label={`Pair ${cardLabel} with ${item.label}`}
                  onClick={() => place(card.id, item.id)}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                data-match-return-card={card.id}
                disabled={disabled || value[index] === null}
                aria-label={`Return ${cardLabel} to the tray`}
                onClick={() => {
                  const next = [...value]
                  next[index] = null
                  onChange(next)
                }}
              >
                Return to tray
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div ref={root} className="flex flex-col gap-3" aria-labelledby={promptId}>
      <div id={promptId} className="text-slate-700">{instance.prompt}</div>
      {regionFor(null)}
      {left.map((item) => regionFor(item.id))}
    </div>
  )
}

function ClockWidget({ instance, value, onChange, disabled }) {
  const drag = useRef(null)
  const [hour, minute] = value
  const time = `${hour}:${String(minute).padStart(2, '0')}`

  const updateFromPointer = (event) => {
    const current = drag.current
    if (disabled || current === null) return
    const face = event.currentTarget
    const rect = face.getBoundingClientRect()
    const angle = ((Math.atan2(event.clientX - (rect.left + rect.width / 2), (rect.top + rect.height / 2) - event.clientY) * 180) / Math.PI + 360) % 360
    const next = [...value]
    if (current.which === 'minute') next[1] = (Math.round(angle / 30) % 12) * 5
    else next[0] = Math.floor(angle / 30) || 12
    onChange(next)
  }

  const stepHour = (amount) => {
    if (disabled) return
    const next = [...value]
    next[0] = ((hour - 1 + amount + 12) % 12) + 1
    onChange(next)
  }

  const stepMinute = (amount) => {
    if (disabled) return
    const next = [...value]
    next[1] = (minute + amount + 60) % 60
    onChange(next)
  }

  const stepperClassName = 'min-h-[56px] min-w-[56px] rounded bg-slate-100 px-4 py-2 text-xl font-semibold'

  return (
    <div className="flex flex-col gap-4" data-clock role="group" aria-live="polite" data-clock-time={time} aria-label={`Clock, hands showing ${time}`}>
      <div className="text-slate-700">{instance.prompt}</div>
      <svg
        data-clock-face
        viewBox="0 0 200 200"
        role="img"
        aria-label="Clock face"
        className="h-64 w-64 touch-none rounded-full border border-slate-300"
        onPointerDown={(event) => {
          if (disabled) return
          if (event.target.closest('button') !== null) return
          const handElement = event.target.closest('[data-clock-hand]')
          if (handElement === null) return
          handElement.setPointerCapture?.(event.pointerId)
          drag.current = { which: handElement.dataset.clockHand, original: [...value], hand: handElement }
        }}
        onPointerMove={updateFromPointer}
        onPointerUp={(event) => {
          if (disabled || drag.current === null) return
          const current = drag.current
          drag.current = null
          current.hand.releasePointerCapture?.(event.pointerId)
        }}
        onPointerCancel={(event) => {
          const current = drag.current
          if (disabled || current === null) return
          onChange(current.original)
          drag.current = null
          current.hand.releasePointerCapture?.(event.pointerId)
        }}
      >
        <circle cx="100" cy="100" r="88" fill="white" />
        <g data-clock-dial textAnchor="middle" dominantBaseline="middle" className="fill-slate-700 text-sm">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((number) => {
            const angle = number * 30
            const x = Number((100 + 70 * Math.sin((angle * Math.PI) / 180)).toFixed(2))
            const y = Number((100 - 70 * Math.cos((angle * Math.PI) / 180)).toFixed(2))
            return <text key={number} x={x} y={y}> {number} </text>
          })}
        </g>
        <g
          data-clock-hand="hour"
          aria-hidden="true"
          transform={`rotate(${(hour % 12) * 30 + minute * 0.5} 100 100)`}
        >
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="48"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle data-clock-hit="hour" aria-hidden="true" cx="100" cy="68" r="23" fill="transparent" pointerEvents="all" />
        </g>
        <g
          data-clock-hand="minute"
          aria-hidden="true"
          transform={`rotate(${minute * 6} 100 100)`}
        >
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="28"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle data-clock-hit="minute" aria-hidden="true" cx="100" cy="38" r="23" fill="transparent" pointerEvents="all" />
        </g>
        <circle cx="100" cy="100" r="5" fill="currentColor" />
      </svg>
      <div className="flex flex-wrap gap-2">
        <button className={stepperClassName} type="button" data-clock-step="hour-back" aria-label={`Move the hour hand back, from ${time}`} disabled={disabled} onClick={() => stepHour(-1)}>Hour back</button>
        <button className={stepperClassName} type="button" data-clock-step="hour-forward" aria-label={`Move the hour hand forward, from ${time}`} disabled={disabled} onClick={() => stepHour(1)}>Hour on</button>
        <button className={stepperClassName} type="button" data-clock-step="minute-back" aria-label={`Move the minute hand back, from ${time}`} disabled={disabled} onClick={() => stepMinute(-5)}>Minute back</button>
        <button className={stepperClassName} type="button" data-clock-step="minute-forward" aria-label={`Move the minute hand forward, from ${time}`} disabled={disabled} onClick={() => stepMinute(5)}>Minute on</button>
      </div>
    </div>
  )
}

export { NumberWidget, TextWidget, ColumnWidget, FractionWidget, ClozeWidget, ChoiceWidget, OrderWidget, SortWidget, MatchWidget, ClockWidget, CoinsWidget, TapSelectWidget }
