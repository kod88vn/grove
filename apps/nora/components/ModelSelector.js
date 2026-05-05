'use client'

export function ModelSelector({ modelList, selectedModel, onChange, disabled }) {
  return (
    <select
      value={selectedModel}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
    >
      {modelList.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  )
}
