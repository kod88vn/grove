'use client'

import {
  ChoiceWidget,
  ClockWidget,
  CoinsWidget,
  ClozeWidget,
  ColumnWidget,
  FractionWidget,
  MatchWidget,
  NumberWidget,
  OrderWidget,
  SortWidget,
  TapSelectWidget,
} from './widgets'
import { FractionBarWidget } from './FractionBarWidget'
import { NumberLineWidget } from './NumberLineWidget'

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
  if (instance.widget === 'clock') {
    return <ClockWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'coins') {
    return <CoinsWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'tap-select') {
    return <TapSelectWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'fraction-bar') {
    return <FractionBarWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  if (instance.widget === 'number-line') {
    return <NumberLineWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
  }
  throw new Error(`unknown widget: ${instance.widget}`)
}
