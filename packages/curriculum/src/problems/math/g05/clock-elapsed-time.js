const DURATIONS = []
for (let minutes = 65; minutes <= 175; minutes += 5) {
  if (minutes % 60 !== 0) DURATIONS.push(minutes)
}

const SITUATIONS = [
  'A film',
  'A swimming lesson',
  'A train ride',
  'A cake in the oven',
  'A museum visit',
  'A music rehearsal',
  'A soccer practice',
  'A science experiment',
  'A library workshop',
  'A ferry trip',
  'A family hike',
  'A dance class',
  'A school assembly',
  'A craft project',
  'A bus journey',
  'A garden lesson',
  'A puppet show',
  'A picnic',
  'A pottery class',
  'A board game',
  'A nature walk',
  'A cooking class',
  'A concert',
  'A visit to the aquarium',
]

const formatTime = ({ hour, minute }) => `${hour}:${String(minute).padStart(2, '0')}`

const addDuration = (start, duration) => {
  const total = (start.hour % 12) * 60 + start.minute + duration
  const wrapped = total % (12 * 60)
  const hour = Math.floor(wrapped / 60)
  return { hour: hour === 0 ? 12 : hour, minute: wrapped % 60 }
}

const makeProblem = (rng) => {
  const start = { hour: rng.int(1, 12), minute: rng.int(1, 11) * 5 }
  const duration = rng.pick(DURATIONS)
  const situation = rng.pick(SITUATIONS)
  const answer = addDuration(start, duration)
  const nextOClock = { hour: start.hour === 12 ? 1 : start.hour + 1, minute: 0 }
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60
  const hourText = `${hours} hour${hours === 1 ? '' : 's'}`
  const minuteText = `${minutes} minute${minutes === 1 ? '' : 's'}`

  return {
    prompt: `${situation} starts on the clock face and lasts ${hourText} and ${minuteText}. Move the hands to show when it ends.`,
    visual: {
      kind: 'clock',
      start,
    },
    answer,
    hints: [
      'Read the starting time from the clock face, then count on to the next o’clock.',
      'Subtract the minutes needed to reach the next o’clock, then count the remaining hours and minutes.',
    ],
    explanation: `The clock starts at ${formatTime(start)}. Count on to ${formatTime(nextOClock)}, then continue for the remaining time. The clock ends at ${formatTime(answer)}.`,
  }
}

export const templates = [{
  id: 'm5.md.time-money/clock-elapsed-time',
  skill: 'm5.md.time-money',
  title: 'Elapsed Time on a Clock',
  widget: 'clock',
  version: 1,
  difficulty: 2,
  generate: makeProblem,
}]
