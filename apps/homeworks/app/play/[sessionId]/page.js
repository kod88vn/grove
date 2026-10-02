import { SessionRunner } from '@/components/SessionRunner'

export default async function Page({ params, searchParams }) {
  const { sessionId } = await params
  const { skill, count: rawCount, problemId, studentId } = await searchParams
  const parsedCount = Number(rawCount)
  const count = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 8

  return <SessionRunner
    sessionId={sessionId}
    skill={skill}
    count={count}
    {...(problemId ? { problemId } : {})}
    {...(studentId ? { studentId } : {})}
  />
}