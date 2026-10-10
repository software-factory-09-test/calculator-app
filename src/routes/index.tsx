import { createFileRoute } from '@tanstack/react-router'
import Calculator from '../components/Calculator'

export const Route = createFileRoute('/')({
  component: App,
  head: () => ({
    meta: [{ title: 'Calculator · TanStack Start' }],
  }),
})

function App() {
  return (
    <main className="page-wrap px-4 pb-12 pt-10 sm:pt-14">
      <div className="mx-auto mb-6 max-w-sm text-center sm:mb-8 sm:max-w-md">
        <p className="island-kicker mb-2">TanStack Start Calculator</p>
        <h1 className="display-title mb-3 text-3xl leading-tight font-bold tracking-tight text-[var(--sea-ink)] sm:text-4xl">
          Crunch numbers, cleanly.
        </h1>
        <p className="m-0 text-base text-[var(--sea-ink-soft)] sm:text-lg">
          A fully interactive calculator — click the keys or use your physical
          keyboard.
        </p>
      </div>

      <Calculator />
    </main>
  )
}
