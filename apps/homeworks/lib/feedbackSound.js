export function getAudioContext() {
  if (typeof window === 'undefined') return null

  const Ctor = window.AudioContext || window.webkitAudioContext
  if (typeof Ctor !== 'function') return null

  try {
    return new Ctor()
  } catch {
    return null
  }
}

export function playFeedbackTone(context, correct) {
  try {
    if (!context) return
    if (context.state === 'suspended') context.resume()

    const frequencies = correct ? [523, 659] : [220]
    const duration = correct ? 0.18 : 0.12
    const start = context.currentTime

    for (const frequency of frequencies) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.1, start)
      gain.gain.linearRampToValueAtTime(0, start + duration)
      oscillator.start(start)
      oscillator.stop(start + duration)
    }
  } catch {
    return undefined
  }
}
