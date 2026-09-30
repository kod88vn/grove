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
  if (widget === 'match') return instance.visual.right.map(() => null)
  if (widget === 'clock') return [instance.visual.start.hour, instance.visual.start.minute]
  if (widget === 'coins') return {}
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
  if (widget === 'match') {
    return {
      pairs: instance.visual.right.flatMap((card, index) => (
        value[index] === null ? [] : [{ left: value[index], right: card.id }]
      )),
    }
  }
  if (widget === 'clock') return { hour: value[0], minute: value[1] }
  if (widget === 'coins') return { counts: value }
  throw new Error(`unknown widget: ${widget}`)
}
