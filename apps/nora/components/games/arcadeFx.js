export function createBurstParticles(count = 12) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${Date.now()}-${index}`,
    left: 8 + Math.random() * 84,
    top: 10 + Math.random() * 72,
    delayMs: Math.round(Math.random() * 180),
    size: 6 + Math.round(Math.random() * 8),
  }))
}

function getTonePattern(effect) {
  if (effect === 'success') {
    return [
      { freq: 520, duration: 0.08 },
      { freq: 660, duration: 0.09 },
      { freq: 820, duration: 0.12 },
    ]
  }

  if (effect === 'fail') {
    return [
      { freq: 320, duration: 0.1 },
      { freq: 240, duration: 0.14 },
    ]
  }

  if (effect === 'win') {
    return [
      { freq: 523.25, duration: 0.08 },
      { freq: 659.25, duration: 0.08 },
      { freq: 783.99, duration: 0.1 },
      { freq: 1046.5, duration: 0.18 },
    ]
  }

  if (effect === 'start') {
    return [
      { freq: 440, duration: 0.06 },
      { freq: 554.37, duration: 0.1 },
    ]
  }

  return [{ freq: 460, duration: 0.06 }]
}

export function playArcadeEffect(effect = 'tap') {
  if (typeof window === 'undefined') {
    return
  }

  const Context = window.AudioContext || window.webkitAudioContext
  if (!Context) {
    return
  }

  const context = new Context()
  const pattern = getTonePattern(effect)
  let cursor = context.currentTime

  for (const note of pattern) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = effect === 'fail' ? 'sawtooth' : 'triangle'
    oscillator.frequency.setValueAtTime(note.freq, cursor)

    gain.gain.setValueAtTime(0.0001, cursor)
    gain.gain.linearRampToValueAtTime(0.045, cursor + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + note.duration)

    oscillator.connect(gain)
    gain.connect(context.destination)

    oscillator.start(cursor)
    oscillator.stop(cursor + note.duration)

    cursor += note.duration + 0.02
  }

  setTimeout(() => {
    context.close().catch(() => {})
  }, 420)
}
