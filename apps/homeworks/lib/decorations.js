export const DECORATIONS = Object.freeze([
  Object.freeze({ id: 'lantern', name: 'Lantern', price: 3 }),
  Object.freeze({ id: 'bench', name: 'Bench', price: 4 }),
  Object.freeze({ id: 'pond', name: 'Pond', price: 6 }),
])

export function findDecoration(id) {
  return DECORATIONS.find((decoration) => decoration.id === id) ?? null
}
