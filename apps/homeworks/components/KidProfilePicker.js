'use client'

const AVATARS = ['🦊', '🐻', '🐼', '🐸', '🦉', '🐱', '🐢', '🦄']

export function KidProfilePicker({
  students, studentId, onStudentChange, name, onNameChange, grade, onGradeChange,
  avatar, onAvatarChange, busy, onCreateStudent,
}) {
  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <label className="block text-lg font-bold text-slate-900" htmlFor="kid-profile">Who's practicing?</label>
      <select id="kid-profile" className="mt-2 min-h-14 w-full rounded-xl border border-slate-400 px-4 text-lg" value={studentId} onChange={onStudentChange}>
        {students.map((student) => <option key={student.id} value={student.id}>{student.avatar} {student.display_name} · Grade {student.grade}</option>)}
      </select>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_72px_120px_auto]" onSubmit={onCreateStudent}>
        <label className="sr-only" htmlFor="new-kid-name">Name</label>
        <input id="new-kid-name" className="min-h-14 rounded-xl border border-slate-400 px-4 text-lg" placeholder="Add a kid profile" value={name} onChange={(event) => onNameChange(event.target.value)} required />
        <label className="sr-only" htmlFor="new-kid-avatar">Avatar</label>
        <select id="new-kid-avatar" aria-label="Choose an avatar" className="min-h-14 rounded-xl border border-slate-400 px-3 text-2xl" value={avatar} onChange={(event) => onAvatarChange(event.target.value)}>
          {AVATARS.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </select>
        <label className="sr-only" htmlFor="new-kid-grade">Grade</label>
        <select id="new-kid-grade" className="min-h-14 rounded-xl border border-slate-400 px-3 text-lg" value={grade} onChange={(event) => onGradeChange(event.target.value)}>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Grade {index + 1}</option>)}
        </select>
        <button disabled={busy} className="min-h-14 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-60">Add profile</button>
      </form>
    </section>
  )
}
