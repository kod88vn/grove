export const MATH_LIGHTNING_LEVELS = [
  { name: 'Rookie', range: 10, time: 10, rewardMultiplier: 1 },
  { name: 'Pro', range: 12, time: 7, rewardMultiplier: 1.4 },
  { name: 'Expert', range: 15, time: 5, rewardMultiplier: 1.8 },
  { name: 'Lightning', range: 20, time: 3, rewardMultiplier: 2.4 },
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function adjustMathLightningLevel(currentLevel, wasSuccess) {
  const next = wasSuccess ? currentLevel + 1 : currentLevel - 1
  return clamp(next, 0, MATH_LIGHTNING_LEVELS.length - 1)
}

export function generateMathLightningQuestion(levelIndex, rng = Math.random) {
  const config = MATH_LIGHTNING_LEVELS[clamp(levelIndex, 0, MATH_LIGHTNING_LEVELS.length - 1)]
  const a = Math.floor(rng() * config.range) + 1
  const b = Math.floor(rng() * config.range) + 1
  return { a, b, answer: a * b }
}

export function scoreMathLightningAnswer({ userInput, answer, timeLeft, levelIndex, isTimeout = false }) {
  const normalizedInput = Number.parseInt(String(userInput), 10)
  const isCorrect = !isTimeout && normalizedInput === answer
  if (!isCorrect) {
    return { isCorrect: false, points: 0 }
  }

  const safeTime = Math.max(0, Number(timeLeft) || 0)
  const config = MATH_LIGHTNING_LEVELS[clamp(levelIndex, 0, MATH_LIGHTNING_LEVELS.length - 1)]
  const points = Math.ceil(safeTime * 10 * config.rewardMultiplier)
  return { isCorrect: true, points }
}
