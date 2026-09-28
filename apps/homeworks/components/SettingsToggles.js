'use client'

import { useKidSettings } from './KidSettingsProvider'

export function SettingsToggles() {
  const { settings, setSetting, prefersReducedMotion } = useKidSettings()

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={settings.animations}
          onChange={(event) => setSetting('animations', event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-medium text-slate-900">Animations</span>
          {prefersReducedMotion && (
            <span className="block text-sm text-slate-600">Your device asks for reduced motion, so animations stay off.</span>
          )}
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={settings.sounds}
          onChange={(event) => setSetting('sounds', event.target.checked)}
          className="mt-1"
        />
        <span className="font-medium text-slate-900">Sounds</span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={settings.dyslexiaFont}
          onChange={(event) => setSetting('dyslexiaFont', event.target.checked)}
          className="mt-1"
        />
        <span className="font-medium text-slate-900">Easy-read font</span>
      </label>
    </div>
  )
}