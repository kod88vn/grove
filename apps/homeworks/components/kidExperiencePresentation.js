const gardenStages = {
  seed: { icon: '🌰', label: 'Seed — ready to begin' },
  sprout: { icon: '🌱', label: 'Sprout — you tried this skill' },
  sapling: { icon: '🌿', label: 'Sapling — growing with practice' },
  tree: { icon: '🌳', label: 'Tree — strong across practice days' },
  fruiting: { icon: '🍎', label: 'Fruiting — spaced review complete' },
}

export function gardenStagePresentation(stage) {
  return gardenStages[stage]
}

export function continueHref(session, studentId) {
  const query = new URLSearchParams({ skill: session.skillId, problemId: session.problemId, count: '1', studentId })
  return `/play/${session.sessionId}?${query}`
}
