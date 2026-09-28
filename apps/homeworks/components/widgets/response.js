export function emptyValue(instance) {
  const { widget } = instance
  if (widget === 'number' || widget === 'column' || widget === 'fraction') return ''
  if (widget === 'cloze') {
    const blanks = instance.visual.sentence.match(/____/g) ?? []
    return blanks.map(() => null)
  }
  if (widget === 'choice') return ''
  if (widget === 'order') return instance.visual.items.map((item) => item.id)
  throw new Error(`unknown widget: ${widget}`)
}

export function toResponse(instance, value) {
  const { widget } = instance
  if (widget === 'number' || widget === 'column') return { value }
  if (widget === 'fraction') return { text: value }
  if (widget === 'cloze') return { blanks: value.map((entry) => entry ?? '') }
  if (widget === 'choice') return { id: value }
  if (widget === 'order') return { sequence: value }
  throw new Error(`unknown widget: ${widget}`)
}
