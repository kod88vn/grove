const READING_DOMAINS = [
  { id: 'random', name: '🎲 Random (Surprise me!)', category: 'mixed' },
  { id: 'science', name: '🔬 Science', category: 'stem' },
  { id: 'history', name: '📜 History', category: 'humanities' },
  { id: 'nature', name: '🌿 Nature & Animals', category: 'stem' },
  { id: 'space exploration', name: '🚀 Space Exploration', category: 'stem' },
  { id: 'marine life', name: '🐋 Marine Life', category: 'stem' },
  { id: 'environmental care', name: '🌍 Environmental Care', category: 'stem' },
  { id: 'engineering', name: '⚙️ Engineering', category: 'stem' },
  { id: 'technology and coding', name: '💻 Technology & Coding', category: 'stem' },
  { id: 'geography', name: '🗺️ Geography', category: 'humanities' },
  { id: 'food and nutrition', name: '🍎 Food & Nutrition', category: 'health' },
  { id: 'sports and health', name: '🏃 Sports & Health', category: 'health' },
  { id: 'community helpers', name: '👷 Community Helpers', category: 'social' },
  { id: 'art and design', name: '🎨 Art & Design', category: 'creative' },
  { id: 'music', name: '🎵 Music', category: 'creative' },
  { id: 'architecture', name: '🏛️ Architecture', category: 'creative' },
  { id: 'transportation systems', name: '🚂 Transportation Systems', category: 'stem' },
  { id: 'math in daily life', name: '📐 Math in Daily Life', category: 'stem' },
]

export async function GET() {
  const grouped = {}
  for (const topic of READING_DOMAINS) {
    if (!grouped[topic.category]) grouped[topic.category] = []
    grouped[topic.category].push(topic)
  }

  return Response.json({ topics: READING_DOMAINS, categories: Object.keys(grouped) })
}