'use client'

import {
  ChoiceWidget,
  ClozeWidget,
  ColumnWidget,
  FractionWidget,
  MatchWidget,
  NumberWidget,
  OrderWidget,
  SortWidget,
} from './widgets'

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
  if (instance.widget === 'order') {
    return <OrderWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'sort') {
    return <SortWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'match') {
    return <MatchWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  throw new Error(`unknown widget: ${instance.widget}`)
}
