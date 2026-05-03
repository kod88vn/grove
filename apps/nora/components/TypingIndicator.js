'use client'

const ACCENTS = {
  gray: { bg: 'bg-gray-100', dot: 'bg-gray-400', text: 'text-gray-600' },
  green: { bg: 'bg-green-50', dot: 'bg-green-500', text: 'text-green-700' },
  blue: { bg: 'bg-blue-50', dot: 'bg-blue-400', text: 'text-blue-700' },
}

export function TypingIndicator({ label = '', accent = 'gray' }) {
  const c = ACCENTS[accent] ?? ACCENTS.gray
  return (
    <div className={`flex gap-2 items-center ${c.bg} px-4 py-3 rounded-3xl w-fit rounded-bl-none`}>
      {label && <span className={`text-sm ${c.text} mr-1`}>{label}</span>}
      <span className={`inline-block w-2 h-2 rounded-full ${c.dot} animate-bounce`} style={{ animationDelay: '0s' }} />
      <span className={`inline-block w-2 h-2 rounded-full ${c.dot} animate-bounce`} style={{ animationDelay: '0.2s' }} />
      <span className={`inline-block w-2 h-2 rounded-full ${c.dot} animate-bounce`} style={{ animationDelay: '0.4s' }} />
    </div>
  )
}
