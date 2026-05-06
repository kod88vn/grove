import { createBurstParticles } from '@/components/games/arcadeFx'

describe('arcadeFx helpers', () => {
  test('creates the requested number of particles', () => {
    const particles = createBurstParticles(7)
    expect(particles).toHaveLength(7)
  })

  test('creates particles inside visual bounds', () => {
    const particles = createBurstParticles(10)

    for (const particle of particles) {
      expect(particle.left).toBeGreaterThanOrEqual(8)
      expect(particle.left).toBeLessThanOrEqual(92)
      expect(particle.top).toBeGreaterThanOrEqual(10)
      expect(particle.top).toBeLessThanOrEqual(82)
    }
  })
})
