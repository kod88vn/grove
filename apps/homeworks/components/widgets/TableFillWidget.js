'use client'

export function TableFillWidget({ instance, value, onChange, disabled }) {
  const rows = instance.visual.rows

  const updateCell = (id, nextValue) => {
    if (disabled) return
    onChange({ ...value, [id]: nextValue })
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      <div className="text-slate-700">{instance.prompt}</div>
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" className="w-1/2 border-b border-slate-300 px-2 py-3 text-slate-700">Meters</th>
              <th scope="col" className="w-1/2 border-b border-slate-300 px-2 py-3 text-slate-700">Centimeters</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, meters }) => (
              <tr key={id}>
                <th scope="row" className="border-b border-slate-200 px-2 py-2 font-medium text-slate-800">{meters} m</th>
                <td className="border-b border-slate-200 px-2 py-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={value[id] ?? ''}
                    aria-label={`Centimeters for ${meters} meters, ${id}`}
                    disabled={disabled}
                    onChange={(event) => updateCell(id, event.target.value)}
                    className="min-h-[56px] w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-slate-900 disabled:opacity-50"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}