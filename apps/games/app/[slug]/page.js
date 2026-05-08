import { notFound } from 'next/navigation'

import { ModuleGameArcade } from '../../src/ModuleGameArcade.js'
import { GAME_SLUGS } from '../../src/index.js'
import { getGameModule } from '../../src/gameCatalog.js'

export function generateStaticParams() {
  return GAME_SLUGS.map((slug) => ({ slug }))
}

export default async function GameDetailPage({ params }) {
  const { slug } = await params
  const module = getGameModule(slug)

  if (!module) {
    notFound()
  }

  return <ModuleGameArcade module={module} />
}