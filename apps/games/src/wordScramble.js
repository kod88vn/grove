export function scrambleWord(word, random = Math.random) {
  if (new Set(word).size < 2) return word

  const letters = word.split('')
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[letters[i], letters[j]] = [letters[j], letters[i]]
  }

  if (letters.join('') !== word) return letters.join('')

  for (let i = 0; i < letters.length - 1; i++) {
    if (letters[i] !== letters[i + 1]) {
      ;[letters[i], letters[i + 1]] = [letters[i + 1], letters[i]]
      break
    }
  }

  return letters.join('')
}
