// Set environment variables before tests run
process.env.HOMEWORKS_DB_PATH = ':memory:'

if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class PointerEvent extends window.MouseEvent {
    constructor(type, init = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? ''
      this.isPrimary = init.isPrimary ?? false
    }
  }
}