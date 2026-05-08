import '@testing-library/jest-dom'

// scrollIntoView is not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = jest.fn()

// next/navigation hooks require the App Router context which isn't available in jsdom.
// Provide a global mock so any component using usePathname/useRouter etc. can be tested.
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
  usePathname: jest.fn(() => '/'),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))
