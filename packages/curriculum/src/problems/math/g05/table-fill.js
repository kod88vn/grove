function generateTable(rng) {
  const metersPool = Array.from({ length: 1000 }, (_, index) => index + 1)
  const meters = rng.shuffle(metersPool).slice(0, 4)
  const rows = meters.map((value) => ({ id: `meters-${value}`, meters: value }))
  const cells = Object.fromEntries(rows.map(({ id, meters: value }) => [id, value * 100]))
  return { rows, cells }
}

export const templates = [{
  id: 'm5.md.metric-units/convert-meters-to-centimeters',
  skill: 'm5.md.metric-units',
  title: 'Convert Meters to Centimeters',
  difficulty: 1,
  widget: 'table-fill',
  version: 1,
  generate: (rng) => {
    const { rows, cells } = generateTable(rng)
    return {
      prompt: 'Complete the table by converting each measurement from meters to centimeters. There are 100 centimeters in one meter.',
      visual: { kind: 'table-fill', rows },
      answer: { cells },
      hints: ['One meter is equal to 100 centimeters.', 'Multiply each number of meters by 100.'],
      explanation: rows.map(({ id, meters }) => `${meters} meters is ${cells[id]} centimeters.`).join(' '),
    }
  },
}];
