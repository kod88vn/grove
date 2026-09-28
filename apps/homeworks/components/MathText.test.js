/**
 * P2.4 — decision D5: KaTeX is the maths renderer for Band C/D.
 *
 * This pins three things:
 *   1. the dependency is installed at an EXACT version (no range), and the version
 *      actually resolved in node_modules is that same version;
 *   2. `<MathText>` renders real maths (fraction, exponent, root, pi) as MathML +
 *      KaTeX HTML, and is server-renderable (no 'use client', no CSS import);
 *   3. hostile LaTeX cannot inject HTML: KaTeX `trust` stays false so `\href` never
 *      becomes an anchor, `\htmlClass` never becomes a class, and malformed input
 *      renders an inert error span instead of throwing.
 *
 * The CSS/font side of the install is wired once, globally, in app/layout.js —
 * importing it from the component would break jest (no CSS transform) and Next's
 * global-CSS rule.
 */

import fs from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import katex from 'katex'
import { MathText } from './MathText'

const componentSource = fs.readFileSync(path.join(__dirname, 'MathText.js'), 'utf8')
const layoutSource = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'layout.js'),
  'utf8',
)
const homeworksPkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
)

describe('D5 dependency is installed and pinned', () => {
  test('apps/homeworks declares katex at an exact version', () => {
    const declared = homeworksPkg.dependencies.katex
    expect(declared).toBe('0.18.9')
    expect(declared).not.toMatch(/[\^~*x><|\s]/)
  })

  test('the resolved katex matches the pinned version', () => {
    expect(katex.version).toBe(homeworksPkg.dependencies.katex)
  })

  test('the KaTeX stylesheet is imported once, globally, in the root layout', () => {
    expect(layoutSource).toContain("import 'katex/dist/katex.min.css'")
    expect(componentSource).not.toContain('katex.min.css')
  })
})

describe('MathText renders maths', () => {
  test('a fraction renders MathML and KaTeX markup', () => {
    const { container } = render(<MathText latex="\frac{3}{4}" />)
    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.querySelector('math')).not.toBeNull()
    expect(container.innerHTML).toContain('mfrac')
    expect(container.textContent).toContain('3')
    expect(container.textContent).toContain('4')
  })

  test('an exponent renders a superscript', () => {
    const { container } = render(<MathText latex="2^{10}" />)
    expect(container.innerHTML).toContain('msup')
  })

  test('a square root renders a radical', () => {
    const { container } = render(<MathText latex="\sqrt{49}" />)
    expect(container.innerHTML).toContain('msqrt')
  })

  test('pi renders as the pi character', () => {
    const { container } = render(<MathText latex="\pi r^2" />)
    expect(container.textContent).toContain('\u03c0')
  })

  test('inline by default, block when displayMode is set', () => {
    const inline = render(<MathText latex="x+1" />)
    expect(inline.container.querySelector('.katex-display')).toBeNull()

    const block = render(<MathText latex="x+1" displayMode />)
    expect(block.container.querySelector('.katex-display')).not.toBeNull()
  })
})

describe('MathText cannot be used to inject HTML', () => {
  test('\\href does not become an anchor (KaTeX trust stays false)', () => {
    const { container } = render(<MathText latex="\href{javascript:alert(1)}{click}" />)
    expect(container.querySelector('a')).toBeNull()
    expect(container.innerHTML).not.toMatch(/href\s*=/i)
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
  })

  test('\\htmlClass does not become a class', () => {
    const { container } = render(<MathText latex="\htmlClass{evil}{x}" />)
    expect(container.querySelector('.evil')).toBeNull()
  })

  test('\\includegraphics does not become an image', () => {
    const { container } = render(<MathText latex="\includegraphics{x}" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).not.toMatch(/\ssrc\s*=/i)
  })

  test('malformed LaTeX renders an inert error instead of throwing', () => {
    let container
    expect(() => {
      container = render(<MathText latex="\frac{1}{" />).container
    }).not.toThrow()
    expect(container.querySelector('.katex-error')).not.toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })
})

describe('MathText is server-renderable', () => {
  test('it is not a client component and holds no browser-only code', () => {
    expect(componentSource).not.toMatch(/['"]use client['"]/)
    expect(componentSource).not.toMatch(/\buseState\b|\buseEffect\b|\bwindow\./)
  })

  test('rendering does not touch the DOM or any browser global', () => {
    const element = MathText({ latex: '\\frac{3}{4}' })
    expect(element).toBeTruthy()
    expect(typeof element).toBe('object')
  })
})
