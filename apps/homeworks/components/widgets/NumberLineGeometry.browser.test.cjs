const { chromium } = require('playwright')

const cases = [[7, 4], [9, 6], [1, 8], [2, 10], [4, 12]]

async function loadSeed(page, seed, N, curriculum) {
  const response = await page.goto('http://localhost:3005/homeworks/dev/widgets', { waitUntil: 'networkidle' })
  if (response.status() !== 200) throw new Error(`gallery HTTP ${response.status()}`)
  const card = page.locator('[data-widget="number-line"]')
  await card.waitFor()
  const rendered = curriculum.render(curriculum.getProblem('m5.nf.equiv-fractions/place-on-number-line'), seed)
  const sample = { widget: rendered.widget, instance: curriculum.toInstance(rendered), answer: rendered.answer, explanation: rendered.explanation }
  if (sample.instance.visual.segments !== N) throw new Error(`seed ${seed}: expected ${N}, got ${sample.instance.visual.segments}`)
  await card.evaluate((article, actual) => {
    for (const other of document.querySelectorAll('article[data-widget]')) if (other !== article) other.style.display = 'none'
    let fiber = article[Object.keys(article).find(key => key.startsWith('__reactFiber$'))]
    while (fiber && fiber.memoizedProps?.sample?.widget !== 'number-line') fiber = fiber.return
    if (!fiber) throw new Error('gallery sample fiber not found')
    Object.assign(fiber.memoizedProps.sample, actual)
    article.querySelector('button:nth-last-child(1)')?.click()
  }, sample)
  await card.getByRole('button', { name: `Mark ${N} of ${N}` }).waitFor()
  const actualN = await card.locator('[data-number-line-tick]').count() - 1
  if (actualN !== N) throw new Error(`seed ${seed}: browser rendered N=${actualN}, expected ${N}`)
  return { card, sample }
}

async function geometry(card) {
  return card.evaluate(article => {
    const box = element => {
      const r = element.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2, right: r.right, bottom: r.bottom }
    }
    const axisElement = article.querySelector('[data-number-line-axis]')
    const axis = box(axisElement)
    const inset = getComputedStyle(axisElement).clipPath.match(/^inset\((\d+(?:\.\d+)?)px/)
    const paintedY = axis.y + (inset ? Number(inset[1]) : axis.height / 2)
    const ticks = [...article.querySelectorAll('[data-number-line-tick]')].map(button => ({
      target: box(button), mark: box(button.querySelector('span[aria-hidden]')),
    }))
    return { axis, paintedY, ticks, labels: [...article.querySelectorAll('[data-number-line-endpoint]')].map(box), card: box(article), viewport: innerWidth }
  })
}

function assertGeometry({ axis, paintedY, ticks, labels, card, viewport }, N) {
  const failures = []
  if (card.x < 0 || card.right > viewport) failures.push('number-line card escapes viewport')
  ticks.forEach(({ target, mark }, k) => {
    if (target.width < 44 || target.height < 44) failures.push(`tick ${k}: target <44x44`)
    if (mark.cx < target.x || mark.cx > target.x + target.width || mark.cy < target.y || mark.cy > target.bottom) failures.push(`tick ${k}: painted mark outside own button`)
    if (paintedY < target.y || paintedY > target.bottom) failures.push(`tick ${k}: painted axis misses button`)
    if (Math.abs(target.cx - (axis.x + axis.width * k / N)) > 1) failures.push(`tick ${k}: not linear`)
    for (let j = 0; j < k; j++) {
      const other = ticks[j].target
      if (target.x < other.x + other.width && other.x < target.x + target.width && target.y < other.y + other.height && other.y < target.bottom) failures.push(`ticks ${j}/${k}: overlap`)
    }
  })
  if (labels.length !== 2 || labels.some((label, i) => label.y - paintedY > 48 || Math.abs(label.cx - ticks[i ? N : 0].target.cx) > 2)) failures.push('endpoint labels not beside painted axis')
  return failures
}

async function physicalClick(page, card, k, N) {
  const button = card.getByRole('button', { name: `Mark ${k} of ${N}` })
  await button.scrollIntoViewIfNeeded()
  const mark = await button.evaluate(element => {
    const r = element.querySelector('span[aria-hidden]').getBoundingClientRect()
    const x = r.x + r.width / 2, y = r.y + r.height / 2
    return { x, y, hit: document.elementFromPoint(x, y)?.closest('button[data-number-line-tick]')?.getAttribute('aria-label'), viewport: innerWidth }
  })
  if (mark.x < 0 || mark.x > mark.viewport) return `tick ${k}: mark is not visible after scrolling`
  if (mark.hit !== `Mark ${k} of ${N}`) return `tick ${k}: painted mark hit ${mark.hit}`
  await page.mouse.click(mark.x, mark.y)
  if (await button.getAttribute('aria-pressed') !== 'true') return `physical painted tick ${k} selected wrong button`
  return null
}

async function assertClicks(page, card, N, answer) {
  const failures = []
  for (let k = 0; k <= N; k++) {
    const failure = await physicalClick(page, card, k, N)
    if (failure) failures.push(failure)
  }
  const wrong = answer === 0 ? 1 : answer - 1
  const wrongClick = await physicalClick(page, card, wrong, N)
  if (wrongClick) failures.push(wrongClick)
  await card.getByRole('button', { name: 'Check', exact: true }).click()
  if (await card.locator('[data-verdict]').getAttribute('data-verdict') !== 'wrong') failures.push('wrong Check failed')
  const correctClick = await physicalClick(page, card, answer, N)
  if (correctClick) failures.push(correctClick)
  await card.getByRole('button', { name: 'Check', exact: true }).click()
  if (await card.locator('[data-verdict]').getAttribute('data-verdict') !== 'correct') failures.push('correct Check failed')
  return failures
}

async function assertScrollAndEdgeHits(card, N) {
  const failures = []
  const edges = await card.evaluate(async (article, segments) => {
    const first = article.querySelector('[data-number-line-tick]')
    const scrollport = [...article.querySelectorAll('*')].find(element =>
      element.contains(first) && getComputedStyle(element).overflowX === 'auto')
    if (!scrollport) throw new Error('missing horizontal scrollport around ticks')
    const visible = element => {
      const rect = element.getBoundingClientRect()
      const port = scrollport.getBoundingClientRect()
      return rect.left >= port.left - 1 && rect.right <= port.right + 1 &&
        rect.left >= -1 && rect.right <= innerWidth + 1
    }
    const ticks = [...article.querySelectorAll('[data-number-line-tick]')]
    const labels = [...article.querySelectorAll('[data-number-line-endpoint]')]
    const endpoint = index => ({
      labelVisible: visible(labels[index]),
      markVisible: visible(ticks[index ? segments : 0].querySelector('span[aria-hidden]')),
    })
    scrollport.scrollLeft = 0
    const start = endpoint(0)
    scrollport.scrollLeft = scrollport.scrollWidth
    const end = endpoint(1)
    const width = scrollport.clientWidth
    const overflow = scrollport.scrollWidth - width
    return { start, end, width, overflow }
  }, N)
  if (!edges.start.labelVisible || !edges.start.markVisible) failures.push('left endpoint label/mark clipped at scrollLeft=0')
  if (!edges.end.labelVisible || !edges.end.markVisible) failures.push('right endpoint label/mark clipped at maximum scrollLeft')
  if (edges.width >= N * 44 + 44 && edges.overflow > 1) failures.push(`unnecessary scrolling: ${edges.overflow}px overflow at ${edges.width}px`)
  for (let k = 0; k <= N; k++) {
    const button = card.getByRole('button', { name: `Mark ${k} of ${N}` })
    await button.scrollIntoViewIfNeeded()
    const hits = await button.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const own = element.getAttribute('aria-label')
      return [rect.left + 2, rect.right - 2].map(x => {
        const hit = document.elementFromPoint(x, rect.top + rect.height / 2)?.closest('button[data-number-line-tick]')
        return { own, hit: hit?.getAttribute('aria-label') ?? null }
      })
    })
    if (hits.some(({ own, hit }) => own !== hit)) failures.push(`tick ${k}: edge hits ${JSON.stringify(hits)}`)
  }
  return { edges, failures }
}

async function main() {
  const curriculum = await import('@grove/curriculum')
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [320, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      for (const [seed, N] of cases) {
        const { card, sample } = await loadSeed(page, seed, N, curriculum)
        const result = await geometry(card)
        const failures = assertGeometry(result, N)
        const scroll = await assertScrollAndEdgeHits(card, N)
        failures.push(...scroll.failures)
        failures.push(...await assertClicks(page, card, N, sample.answer.num * N / sample.answer.den))
        failures.push(...errors.splice(0))
        console.log(JSON.stringify({ seed, width, N, scroll: scroll.edges, failures }))
        if (failures.length) process.exitCode = 1
      }
      await page.close()
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
