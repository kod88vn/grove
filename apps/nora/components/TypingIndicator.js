'use client'

export function TypingIndicator({ label = '' }) {
  return (
    <div className="flex gap-2 items-center bg-gray-100 px-4 py-3 rounded-3xl w-fit rounded-bl-none">
      {label && <span className="text-sm text-gray-600 mr-1">{label}</span>}
      <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0s' }} />
      <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
      <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }} />
    </div>
  )
}
