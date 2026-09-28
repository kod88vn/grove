export function emptyValue(instance) {
  const { widget } = instance
  if (widget === 'number' || widget === 'column' || widget === 'fraction') return ''
  if (widget === 'cloze') {
    const blanks = instance.visual.sentence.match(/____/g) ?? []
    return blanks.map(() => null)
  }
  throw new Error(`unknown widget: ${widget}`)
}

export function toResponse(instance, value) {
  const { widget } = instance
  if (widget === 'number' || widget === 'column') return { value }
  if (widget === 'fraction') return { text: value }
  if (widget === 'cloze') return { blanks: value.map((entry) => entry ?? '') }
  throw new Error(`unknown widget: ${widget}`)
}
