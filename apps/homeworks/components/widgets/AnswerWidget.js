'use client'

import { ChoiceWidget, ClozeWidget, ColumnWidget, FractionWidget, NumberWidget } from './widgets'

export function AnswerWidget({ instance, value, onChange, disabled }) {
  if (instance.widget === 'number') {
    return <NumberWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'column') {
    return <ColumnWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'fraction') {
    return <FractionWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'cloze') {
    return <ClozeWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'choice') {
    return <ChoiceWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  throw new Error(`unknown widget: ${instance.widget}`)
}
