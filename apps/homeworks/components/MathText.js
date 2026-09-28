import katex from 'katex'

export function MathText({ latex, displayMode = false }) {
  const html = katex.renderToString(latex, {
    displayMode,
    throwOnError: false,
    output: 'htmlAndMathml',
  })

  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
