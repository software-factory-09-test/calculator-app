import { useEffect, useReducer } from 'react'
import {
  CALCULATOR_KEYS,
  KEYBOARD_MAP,
  initialState,
  reduce,
} from '../lib/calculator'
import type { CalculatorKeyKind } from '../lib/calculator'

function buttonClasses(kind: CalculatorKeyKind): string {
  const base =
    'flex h-14 select-none items-center justify-center rounded-2xl border text-base font-semibold transition active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lagoon-deep)] sm:h-16 sm:text-lg'

  switch (kind) {
    case 'digit':
      return `${base} border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]`
    case 'operator':
      return `${base} border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.16)] text-[var(--lagoon-deep)] hover:bg-[rgba(79,184,178,0.26)]`
    case 'action':
      return `${base} border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]`
    case 'equals':
      return `${base} border-[rgba(47,106,74,0.35)] bg-[var(--lagoon-deep)] text-white hover:brightness-110`
  }
}

export default function Calculator() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const isError = state.status === 'error'

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = KEYBOARD_MAP[event.key]
      if (!action) {
        return
      }

      event.preventDefault()
      dispatch(action)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const displayClasses = [
    'display-title flex min-h-[4rem] items-center justify-end overflow-hidden rounded-2xl border px-4 py-3 text-right text-3xl font-bold tracking-tight sm:min-h-[4.5rem] sm:text-4xl',
    isError
      ? 'border-[var(--danger-line)] bg-[var(--danger-surface)] text-[var(--danger)]'
      : 'border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]',
  ].join(' ')

  return (
    <section
      className="island-shell rise-in mx-auto w-full max-w-sm rounded-[2rem] p-5 sm:max-w-md sm:p-7"
      aria-label="Calculator"
    >
      <div
        role="status"
        aria-live="polite"
        data-testid="calculator-display"
        className={displayClasses}
      >
        <span className="w-full truncate">{state.display}</span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:mt-6 sm:gap-3">
        {CALCULATOR_KEYS.map((key) => (
          <button
            key={key.label}
            type="button"
            aria-label={key.ariaLabel}
            data-action={key.action.type}
            data-kind={key.kind}
            onClick={() => dispatch(key.action)}
            className={buttonClasses(key.kind)}
          >
            {key.label}
          </button>
        ))}
      </div>
    </section>
  )
}
