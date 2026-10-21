'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GardenDecorations } from './GardenDecorations'
import { KidProfilePicker } from './KidProfilePicker'
import { useKidSettings } from './KidSettingsProvider'
import { continueHref, gardenStagePresentation } from './kidExperiencePresentation.js'

const PROFILE_KEY = 'grove.homeworks.studentId'
const DEFAULT_AVATAR = '🦊'
function localCalendarDate() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

async function readJson(url, options) {
  const response = await fetch(url, options)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`)
  return payload
}

export function KidExperienceHub({ mode, embedded = false }) {
  const Landmark = embedded ? 'section' : 'main'
  const { motionAllowed } = useKidSettings()
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState('')
  const [summary, setSummary] = useState(null)
  const [problems, setProblems] = useState([])
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [status, setStatus] = useState('all')
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('5')
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR)
  const [questGrade, setQuestGrade] = useState('5')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [decorationError, setDecorationError] = useState('')
  const [mastery, setMastery] = useState(null)
  const summaryRequest = useRef(0)
  const masteryRequest = useRef(0)
  const problemsRequest = useRef(0)
  const selectedStudentRef = useRef('')

  useEffect(() => {
    readJson('/homeworks/api/students')
      .then(({ students: profiles }) => {
        setStudents(profiles)
        const savedId = window.localStorage.getItem(PROFILE_KEY)
        const selectedId = profiles.some((profile) => profile.id === savedId) ? savedId : profiles[0]?.id ?? ''
        selectedStudentRef.current = selectedId
        setStudentId(selectedId)
      })
      .catch((cause) => setError(cause.message))
  }, [])

  useEffect(() => {
    if (!studentId) {
      setSummary(null)
      return
    }
    const requestId = ++summaryRequest.current
    window.localStorage.setItem(PROFILE_KEY, studentId)
    const date = localCalendarDate()
    readJson(`/homeworks/api/kid-experience?studentId=${encodeURIComponent(studentId)}&date=${date}`)
      .then((payload) => {
        if (summaryRequest.current !== requestId) return
        if (payload.student.id !== studentId) {
          setError('The selected profile did not match the grove response.')
          return
        }
        setSummary(payload)
      })
      .catch((cause) => {
        if (summaryRequest.current === requestId) setError(cause.message)
      })
  }, [studentId])

  useEffect(() => {
    if (!summary || summary.student.id !== studentId) {
      setMastery(null)
      return
    }
    const requestId = ++masteryRequest.current
    const date = localCalendarDate()
    readJson(`/homeworks/api/next?studentId=${encodeURIComponent(studentId)}&date=${date}`)
      .then((payload) => {
        if (masteryRequest.current === requestId) setMastery(payload)
      })
      .catch((cause) => {
        if (masteryRequest.current === requestId) setError(cause.message)
      })
  }, [summary, studentId])

  useEffect(() => {
    if (summary?.student.id === studentId) setQuestGrade(String(summary.student.grade))
  }, [summary, studentId])

  useEffect(() => {
    const requestId = ++problemsRequest.current
    if (mode !== 'quests' || !summary || summary.student.id !== studentId || !questGrade) {
      setProblems([])
      return
    }
    readJson(`/homeworks/api/problems?grade=${questGrade}`)
      .then(({ problems: rows }) => {
        if (problemsRequest.current === requestId) setProblems(rows)
      })
      .catch((cause) => {
        if (problemsRequest.current === requestId) setError(cause.message)
      })
  }, [mode, questGrade, summary, studentId])

  const activeSummary = summary?.student.id === studentId ? summary : null

  const topics = useMemo(() => [...new Set(problems.map((problem) => problem.skill))], [problems])
  const filtered = useMemo(() => problems.filter((problem) => {
    if (topic && problem.skill !== topic) return false
    if (difficulty && problem.difficulty !== Number(difficulty)) return false
    const problemStatus = activeSummary?.statuses[problem.id] ?? 'untried'
    if (status !== 'all' && problemStatus !== status) return false
    return true
  }), [problems, topic, difficulty, status, activeSummary])

  async function startSession({ kind, skillId, problemId, count }) {
    if (!activeSummary || activeSummary.student.id !== studentId || selectedStudentRef.current !== studentId) return
    const selectedStudentId = studentId
    const requestId = summaryRequest.current
    setBusy(true)
    setError('')
    try {
      const localDate = localCalendarDate()
      const { sessionId } = await readJson('/homeworks/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudentId, kind, skillId, localDate, tz: localTimeZone() }),
      })
      if (summaryRequest.current !== requestId || selectedStudentRef.current !== selectedStudentId) return
      const query = new URLSearchParams({ skill: skillId, count: String(count), studentId: selectedStudentId })
      if (problemId) query.set('problemId', problemId)
      window.location.assign(`/homeworks/play/${sessionId}?${query}`)
    } catch (cause) {
      if (summaryRequest.current === requestId) setError(cause.message)
    } finally {
      if (summaryRequest.current === requestId) setBusy(false)
    }
  }

  function sessionCount() {
    const grade = activeSummary?.student.grade ?? 5
    return grade <= 2 ? 5 : grade <= 5 ? 8 : 10
  }

  async function playNext() {
    const next = mastery?.next
    if (!next || !activeSummary) return
    const kind = next.kind === 'path' ? 'path' : next.kind === 'review' ? 'review' : 'skill'
    await startSession({ kind, skillId: next.skillId, problemId: next.problemId, count: kind === 'review' ? 1 : sessionCount() })
  }

  const bossTitle = (problemId) => activeSummary?.problems.find((problem) => problem.id === problemId)?.title ?? 'Boss'
  const skillName = (skillId) => activeSummary?.garden.find((tree) => tree.skillId === skillId)?.name ?? skillId

  // A path's chain as buttons: stage icon per skill, locked skills dimmed
  // (they click through to a "grow X first" notice instead of a session).
  function pathChain(path) {
    return path.skills.map((skill) => {
      const lockedNames = skill.lockedBy.map(skillName).join(' and ')
      return (
        <button
          key={skill.skillId}
          disabled={busy}
          title={skill.locked ? `Locked—grow ${lockedNames} first` : skillName(skill.skillId)}
          aria-label={skill.locked ? `Locked: grow ${lockedNames} first` : `Practice ${skillName(skill.skillId)}`}
          onClick={() => {
            if (skill.locked) {
              setError(`Grow "${lockedNames}" first—${skillName(skill.skillId)} is still locked.`)
              return
            }
            startSession({ kind: 'path', skillId: skill.skillId, count: sessionCount() })
          }}
          className={`min-h-14 rounded-lg border px-3 text-xl ${skill.locked ? 'border-slate-300 bg-slate-100 opacity-50' : 'border-emerald-300 bg-emerald-50'}`}
        >
          {gardenStagePresentation(skill.stage).icon}
          {skill.locked && <span aria-hidden="true"> 🔒</span>}
        </button>
      )
    })
  }

  function bossButton(path) {
    return (
      <button
        disabled={busy || !path.bossReady}
        aria-label={path.bossReady ? `Play the ${path.name} boss` : `Grow every skill in ${path.name} to unlock its boss`}
        onClick={() => {
          if (path.bossReady) startSession({ kind: 'path', skillId: path.terminal, problemId: path.bossProblemId, count: 1 })
        }}
        className="min-h-14 rounded-lg bg-amber-300 px-4 font-extrabold text-slate-950 disabled:opacity-60"
      >
        {path.bossReady ? `👑 ${bossTitle(path.bossProblemId)}` : '🔒 Finish the path first'}
      </button>
    )
  }

  async function startDaily() {
    if (!activeSummary || activeSummary.problems.length === 0) return
    const selectedStudentId = studentId
    const requestId = summaryRequest.current
    setBusy(true)
    setError('')
    try {
      const date = localCalendarDate()
      const daily = await readJson(`/homeworks/api/daily?grade=${activeSummary.student.grade}&date=${date}`)
      if (summaryRequest.current !== requestId || selectedStudentRef.current !== selectedStudentId) return
      await startSession({
        kind: 'daily',
        skillId: daily.instance.skill,
        problemId: daily.problemId,
        count: 1,
      })
    } catch (cause) {
      if (summaryRequest.current === requestId) setError(cause.message)
    } finally {
      if (summaryRequest.current === requestId) setBusy(false)
    }
  }

  async function buyDecoration(decorationId) {
    if (!activeSummary) return
    setBusy(true)
    setDecorationError('')
    try {
      await readJson('/homeworks/api/decorations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, decorationId }),
      })
      const date = localCalendarDate()
      const payload = await readJson(`/homeworks/api/kid-experience?studentId=${encodeURIComponent(studentId)}&date=${date}`)
      if (selectedStudentRef.current === studentId) setSummary(payload)
    } catch (cause) {
      setDecorationError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  async function createStudent(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { student } = await readJson('/homeworks/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, avatar, grade: Number(grade) }),
      })
      setStudents((current) => [...current, student])
      summaryRequest.current += 1
      problemsRequest.current += 1
      setSummary(null)
      setProblems([])
      setError('')
      selectedStudentRef.current = student.id
      setStudentId(student.id)
      setName('')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  const profilePicker = <KidProfilePicker
    students={students}
    studentId={studentId}
    onStudentChange={(event) => {
      summaryRequest.current += 1
      problemsRequest.current += 1
      setSummary(null)
      setProblems([])
      setError('')
      setBusy(false)
      setTopic('')
      setDifficulty('')
      setStatus('all')
      selectedStudentRef.current = event.target.value
      setStudentId(event.target.value)
    }}
    name={name}
    onNameChange={setName}
    grade={grade}
    onGradeChange={setGrade}
    avatar={avatar}
    onAvatarChange={setAvatar}
    busy={busy}
    onCreateStudent={createStudent}
  />

  if (error && students.length === 0) return <Landmark className="mx-auto max-w-4xl px-4 py-8"><p role="alert">Couldn't load profiles: {error}</p></Landmark>
  if (!students.length) return <Landmark className="mx-auto max-w-4xl px-4 py-8"><h1 className="text-3xl font-bold">Grove Quests</h1>{profilePicker}</Landmark>

  return (
    <Landmark className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-semibold text-emerald-800">🌿 Nora's Grove</p><h1 className="text-4xl font-extrabold text-slate-950">{mode === 'today' ? 'Today' : mode === 'paths' ? 'Study Paths' : mode === 'quests' ? 'Quest Board' : 'Your Grove'}</h1></div>
        <nav aria-label="Grove navigation" className="flex flex-wrap gap-2">
          <Link className="min-h-14 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold" href="/today">Today</Link>
          <Link className="min-h-14 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold" href="/paths">Paths</Link>
          <Link className="min-h-14 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold" href="/quests">Quests</Link>
          <Link className="min-h-14 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold" href="/garden">Garden</Link>
        </nav>
      </header>
      {profilePicker}
      {error && <p className="mb-4 rounded-lg bg-rose-50 p-4 text-rose-800" role="alert">{error}</p>}
      {!activeSummary ? <div aria-live="polite"><p>Loading your grove…</p>{embedded && mode === 'today' && <button type="button" disabled className="mt-3 min-h-14 rounded-xl bg-amber-300 px-6 text-lg font-extrabold text-slate-950 disabled:opacity-60">🌞 Daily Seed loading…</button>}</div> : (
        <>
          {mode === 'today' && <section className="grid gap-4">
            <div className="rounded-3xl bg-emerald-800 p-6 text-white">
              <p className="text-xl">Welcome, {activeSummary.student.avatar} {activeSummary.student.displayName}!</p>
              <p className="mt-2 text-3xl font-extrabold">☀️ {activeSummary.rewards.sunshine} Sunshine · ⭐ {activeSummary.rewards.stars} stars</p>
              <p className="mt-2">💧 {activeSummary.watering.streak}-day watering streak · {activeSummary.watering.wateredDays}/5 days this week</p>
              {activeSummary.problems.length === 0
                ? <div className="mt-5 rounded-xl bg-white/10 p-4"><p className="text-lg font-semibold">No Daily Seed for Grade {activeSummary.student.grade} yet. Check back when more quests are ready.</p>{embedded && <button type="button" disabled className="mt-3 min-h-14 rounded-xl bg-amber-300 px-6 text-lg font-extrabold text-slate-950 disabled:opacity-60">🌞 Daily Seed unavailable</button>}</div>
                : activeSummary.continueSession
                ? <Link href={continueHref(activeSummary.continueSession, activeSummary.student.id)} className="mt-5 inline-flex min-h-14 items-center rounded-xl bg-amber-300 px-6 text-lg font-extrabold text-slate-950">▶ Continue your quest</Link>
                : <button disabled={busy} onClick={startDaily} className="mt-5 min-h-14 rounded-xl bg-amber-300 px-6 text-lg font-extrabold text-slate-950 disabled:opacity-60">{busy ? 'Getting ready…' : '🌞 Play the Daily Seed'}</button>}
            </div>
            <section className="rounded-2xl border bg-white p-5">
              <h2 className="text-2xl font-bold">{mastery?.next ? "What's next" : 'Try next'}</h2>
              {mastery?.next ? (<>
                <p className="mt-1 text-slate-700">{mastery.next.kind === 'path' ? 'You earned the big quest!' : mastery.next.kind === 'review' ? 'A spaced review is ready to keep this in.' : "Let's grow the next skill."}</p>
                <button disabled={busy} onClick={playNext} className="mt-3 min-h-14 rounded-xl bg-emerald-700 px-6 font-extrabold text-white">
                  {mastery.next.kind === 'path' ? '👑 ' : mastery.next.kind === 'review' ? '🔁 ' : '▶ '}Play “{mastery.next.title}”
                </button>
                {mastery.reviews.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-bold">🍎 Other reviews due</h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {mastery.reviews.filter((review) => !(mastery.next && mastery.next.skillId === review.skillId && mastery.next.kind === 'review')).map((review) => (
                        <button key={`${review.skillId}:${review.dueDate}`} disabled={busy} onClick={() => startSession({ kind: 'review', skillId: review.skillId, problemId: review.problemId, count: 1 })} className="min-h-14 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left font-semibold">
                          🔁 {review.title} <span className="text-slate-700">({review.skillId})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {activeSummary.suggestions.map((skill) => <button key={skill.id} disabled={busy} onClick={() => startSession({ kind: 'skill', skillId: skill.id, count: sessionCount() })} className="min-h-14 rounded-xl border border-emerald-300 p-4 text-left font-semibold">🌱 {skill.label || skill.name}</button>)}
                </div>
              )}
            </section>
          </section>}
          {mode === 'quests' && (<>
            {mastery?.paths?.length > 0 && <section className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-5">
              <h2 className="text-2xl font-bold">🗺 Study paths</h2>
              <p className="mt-1 text-slate-700">Skills that team up into one path—each icon shows how far that skill has grown. Locked skills need their foundations first.</p>
              <div className="mt-3 grid gap-3">
                {mastery.paths.map((path) => (
                  <div key={path.id} className="rounded-xl bg-white p-4">
                    <p className="font-bold">{path.icon} {path.name}{path.bossReady && <span className="text-amber-700"> · 👑 boss ready!</span>}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {pathChain(path)}
                      <button disabled={busy || !path.nextSkillId} onClick={() => {
                        if (path.nextSkillId) startSession({ kind: 'path', skillId: path.nextSkillId, count: sessionCount() })
                      }} className="min-h-14 rounded-lg bg-emerald-700 px-4 font-extrabold text-white disabled:opacity-60">
                        ▶ {path.nextSkillId ? `Play ${skillName(path.nextSkillId)}` : 'All grown!'}
                      </button>
                      {bossButton(path)}
                    </div>
                  </div>
                ))}
              </div>
            </section>}
            <section className="rounded-2xl border bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="font-semibold">Filter by grade<select className="mt-1 min-h-14 w-full rounded-lg border px-3" value={questGrade} onChange={(event) => setQuestGrade(event.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Grade {index + 1}</option>)}</select></label>
              <label className="font-semibold">Topic<select className="mt-1 min-h-14 w-full rounded-lg border px-3" value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">All topics</option>{topics.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="font-semibold">Difficulty<select className="mt-1 min-h-14 w-full rounded-lg border px-3" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">Any</option><option value="1">Sprout</option><option value="2">Sapling</option><option value="3">Tree</option></select></label>
              <label className="font-semibold">Status<select className="mt-1 min-h-14 w-full rounded-lg border px-3" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All</option><option value="untried">Todo</option><option value="attempted">Attempted</option><option value="solved">Solved</option></select></label>
              <button disabled={!filtered.length || busy} onClick={() => {
                const chosen = filtered[Math.floor(Math.random() * filtered.length)]
                startSession({ kind: 'skill', skillId: chosen.skill, problemId: chosen.id, count: 1 })
              }} className="min-h-14 self-end rounded-xl bg-violet-700 px-4 font-bold text-white">🎲 Surprise quest</button>
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">{filtered.map((problem) => <li key={problem.id} className="rounded-xl border p-4">
              <p className="font-bold">{problem.title}</p><p className="mt-1 text-sm text-slate-600">{problem.skill} · {['', '🌱 Sprout', '🌿 Sapling', '🌳 Tree'][problem.difficulty]}</p>
              <button aria-label={`Start ${problem.title} quest`} disabled={busy} onClick={() => startSession({ kind: 'skill', skillId: problem.skill, problemId: problem.id, count: 1 })} className="mt-3 min-h-14 rounded-lg bg-emerald-700 px-5 font-bold text-white">Start quest</button>
            </li>)}</ul>
            {!filtered.length && <p className="mt-5">No quests match those filters.</p>}
            </section>
          </>)}
          {mode === 'paths' && (<>
            <div className="mb-4 rounded-3xl bg-violet-800 p-6 text-white">
              <p className="text-xl">🗺 Study paths</p>
              <p className="mt-1">Grow every skill in a chain into a tree and its 👑 boss unlocks. Locked skills need their foundations first.</p>
            </div>
            {mastery?.paths?.length > 0 ? <div className="grid gap-4">
              {mastery.paths.map((path) => (
                <article key={path.id} className="rounded-2xl border border-violet-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-bold">{path.icon} {path.name}</h2>
                    {path.bossReady
                      ? <span className="rounded-full bg-amber-100 px-4 py-2 font-bold text-amber-800">👑 Boss ready!</span>
                      : <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-600">🔒 Boss locked</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">{pathChain(path)}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {path.nextSkillId && <button disabled={busy} onClick={() => startSession({ kind: 'path', skillId: path.nextSkillId, count: sessionCount() })} className="min-h-14 rounded-xl bg-emerald-700 px-6 font-extrabold text-white">
                      ▶ Play next: {skillName(path.nextSkillId)}
                    </button>}
                    {bossButton(path)}
                  </div>
                </article>
              ))}
            </div> : <p className="rounded-2xl border bg-white p-5">No study paths for this grade yet.</p>}
          </>)}
          {mode === 'garden' && <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-2xl font-bold">🦉 Nora's garden guide</h2>
            <p className="mt-1 text-slate-700">Stars grow your grove; only tried skills sprout. Mastery comes from real practice records.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{activeSummary.garden.map((tree) => {
              const stage = gardenStagePresentation(tree.stage)
              return <article key={tree.skillId} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-label={`${tree.name}: ${stage.label}`}>
                <span className={`text-3xl ${motionAllowed && tree.stage === 'fruiting' ? 'motion-safe:animate-pulse' : ''}`} aria-hidden="true">{stage.icon}</span>
                <h3 className="font-bold">{tree.name}</h3><p>{tree.stage}</p><p className="text-sm text-slate-700">{stage.label}</p>
                {tree.box > 0 && tree.dueDate && <p className="mt-1 text-sm font-semibold text-emerald-800">{tree.dueDate <= localCalendarDate() ? '🍎 A spaced review is due!' : `Next review ${tree.dueDate}`}</p>}
                {tree.box === 5 && <p className="mt-1 text-sm font-semibold text-emerald-800">🎓 Graduated—no more reviews needed.</p>}
              </article>
            })}</div>
            <GardenDecorations summary={activeSummary} error={decorationError} busy={busy} onBuy={buyDecoration} />
            <h2 className="mt-7 text-2xl font-bold">Earned badges</h2>
            <ul className="mt-2 flex flex-wrap gap-2">{activeSummary.badges.length ? activeSummary.badges.map((badge) => <li className="rounded-full bg-amber-100 px-4 py-3 font-semibold" key={badge.id}>🏅 {badge.label}</li>) : <li>No badges yet—every quest is a fresh start.</li>}</ul>
          </section>}
        </>
      )}
    </Landmark>
  )
}