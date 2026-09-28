export function emptyValue(instance) {
  const { widget } = instance
  if (widget === 'number' || widget === 'column' || widget === 'fraction') return ''
  if (widget === 'cloze') {
    const blanks = instance.visual.sentence.match(/____/g) ?? []
    return blanks.map(() => null)
  }
  if (widget === 'choice') return ''
  if (widget === 'order') return instance.visual.items.map((item) => item.id)
  if (widget === 'sort') return instance.visual.items.map(() => null)
  throw new Error(`unknown widget: ${widget}`)
}

export function toResponse(instance, value) {
  const { widget } = instance
  if (widget === 'number' || widget === 'column') return { value }
  if (widget === 'fraction') return { text: value }
  if (widget === 'cloze') return { blanks: value.map((entry) => entry ?? '') }
  if (widget === 'choice') return { id: value }
  if (widget === 'order') return { sequence: value }
  if (widget === 'sort') {
    const buckets = Object.fromEntries(instance.visual.buckets.map((bucket) => [bucket.id, []]))
    instance.visual.items.forEach((item, index) => {
      const bucketId = value[index]
      if (bucketId !== null) buckets[bucketId].push(item.id)
    })
    return { buckets }
  }
  throw new Error(`unknown widget: ${widget}`)
}
