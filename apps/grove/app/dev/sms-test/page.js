import { notFound } from 'next/navigation'

import { SmsTestPanel } from '../../../components/SmsTestPanel'

export const metadata = {
  title: 'SMS Test',
  description: 'Development-only SMS/email-to-text test page',
}

export default function SmsTestPage() {
  const enabledInDev = process.env.NODE_ENV !== 'production' && process.env.ENABLE_SMS_TEST_PAGE !== 'false'
  if (!enabledInDev) {
    notFound()
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">SMS Feature Test</h1>
        <p className="mt-2 text-sm text-slate-600">
          This page is development-only and triggers the nightly digest send path. Real delivery requires SMTP or webhook sender configuration.
        </p>
      </div>
      <SmsTestPanel />
    </main>
  )
}
