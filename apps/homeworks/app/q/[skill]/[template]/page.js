import { SoloPractice } from '@/components/SoloPractice'

export default async function Page({ params }) {
  const { skill, template } = await params
  return <SoloPractice skill={skill} template={template} />
}