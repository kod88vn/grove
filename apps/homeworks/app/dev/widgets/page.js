import { notFound } from 'next/navigation'

import { MathText } from '@/components/MathText'
import { WidgetGallery } from '@/components/WidgetGallery'

import { GALLERY_SEED, MATH_SAMPLE, gallerySamples } from './samples'

export default function WidgetGalleryPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const samples = gallerySamples()

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-slate-900">Widget gallery</h1>
      <p className="mb-6 text-slate-600">
        This dev only workbench shows the fixed widget samples that Nora can use. It never reaches a child.
        Every problem below is rendered from seed {GALLERY_SEED}.
      </p>
      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-4">
        <MathText latex={MATH_SAMPLE.latex} />
        <span className="ml-3 text-slate-600">{MATH_SAMPLE.caption}</span>
      </div>
      <WidgetGallery samples={samples} />
    </main>
  )
}
