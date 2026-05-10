export const NAV_ITEMS = [
  { href: '/chat', label: 'Nora' },
  { href: '/games', label: 'Games' },
  { href: '/shopping-list', label: 'Shopping List' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/homeworks', label: 'Homeworks' },
]

export function getNavItems() {
  return NAV_ITEMS.slice()
}

export function isActiveNavPath(pathname = '/', href = '/') {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}