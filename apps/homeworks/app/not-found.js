export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you're looking for doesn't exist.</p>
      <a
        href="/homeworks"
        className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
      >
        Go back to homeworks
      </a>
    </div>
  )
}
