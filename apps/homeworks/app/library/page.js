import { SkillsLibrary } from '@/components/SkillsLibrary'

export const metadata = {
  title: 'Skills Library - Homeworks',
  description: 'Review your math skills and completed problems',
}

export default function LibraryPage() {
  return (
    <main className="min-h-screen">
      <SkillsLibrary studentId="default" />
    </main>
  )
}
