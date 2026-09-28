import { SettingsToggles } from '../../components/SettingsToggles'

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">Settings</h1>
      <SettingsToggles />
    </main>
  )
}