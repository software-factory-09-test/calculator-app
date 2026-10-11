/**
 * Framework-free calculator engine.
 *
 * All arithmetic and state transitions live here as pure functions so the
 * behaviour can be deterministically unit-tested with Node's built-in test
 * runner (no DOM required). The React component is a thin view over
 * `reduce`, `CALCULATOR_KEYS` and `KEYBOARD_MAP`.
 */

export type CalculatorOperator = '+' | '-' | '×' | '÷'

export type CalculatorStatus = 'idle' | 'running' | 'complete' | 'error'

export interface CalculatorState {
  /** The string currently shown on the display. */
  display: string
  /**
   * Accumulated committed expression text (e.g. `"1 + 2"`), rendered verbatim
   * by `screenText()` before the pending operator glyph.
   */
  leftText: string | null
  /** Stored left-hand operand for a pending operation. */
  accumulator: number | null
  /** Pending operator, if any. */
  operator: CalculatorOperator | null
  /** Lifecycle marker for the current expression. */
  status: CalculatorStatus
  /** When true the next digit replaces the display instead of appending. */
  overwrite: boolean
}

export type CalculatorAction =
  | { type: 'digit'; value: string }
  | { type: 'decimal' }
  | { type: 'operator'; value: CalculatorOperator }
  | { type: 'equals' }
  | { type: 'clear' }
  | { type: 'sign' }
  | { type: 'percent' }
  | { type: 'backspace' }

export const initialState: CalculatorState = {
  display: '0',
  leftText: null,
  accumulator: null,
  operator: null,
  status: 'idle',
  overwrite: true,
}

/** Operator glyphs mirroring the on-screen button labels. */
const OPERATOR_LABELS: Record<CalculatorOperator, string> = {
  '+': '+',
  '-': '−',
  '×': '×',
  '÷': '÷',
}

/**
 * Compose the text the display should show. While an operation is pending this
 * is the full expression (`3 + 5`); otherwise it is just the current operand or
 * result. Pure selector so the view stays a thin projection of the state.
 */
export function screenText(state: CalculatorState): string {
  if (state.operator === null || state.leftText === null) {
    return state.display
  }

  const left = `${state.leftText} ${OPERATOR_LABELS[state.operator]}`
  return state.overwrite ? left : `${left} ${state.display}`
}

/** Significant digits kept when rendering a result to avoid float noise. */
const DISPLAY_PRECISION = 12

/**
 * Format a numeric result for display. Rounds away binary floating-point
 * noise (e.g. `0.1 + 0.2` renders as `0.3`) and maps non-finite values to
 * the error sentinel.
 */
export function formatDisplay(value: number): string {
  if (!Number.isFinite(value)) {
    return 'Error'
  }

  const rounded = Number.parseFloat(value.toPrecision(DISPLAY_PRECISION))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/**
 * Apply a binary operator. Division by zero yields `NaN`, which the reducer
 * treats as the error sentinel.
 */
export function evaluate(
  a: number,
  operator: CalculatorOperator,
  b: number,
): number {
  switch (operator) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? Number.NaN : a / b
  }
}

function errorState(): CalculatorState {
  return { ...initialState, display: 'Error', status: 'error', overwrite: true }
}

function inputDigit(state: CalculatorState, value: string): CalculatorState {
  let display: string
  if (state.overwrite || state.display === '0') {
    display = value
  } else {
    display = state.display + value
  }

  return {
    ...state,
    display,
    overwrite: false,
    status: state.status === 'complete' ? 'idle' : state.status,
  }
}

function inputDecimal(state: CalculatorState): CalculatorState {
  if (state.overwrite) {
    return {
      ...state,
      display: '0.',
      overwrite: false,
      status: state.status === 'complete' ? 'idle' : state.status,
    }
  }

  if (state.display.includes('.')) {
    return state
  }

  return { ...state, display: state.display + '.', overwrite: false }
}

function inputOperator(
  state: CalculatorState,
  operator: CalculatorOperator,
): CalculatorState {
  // Evaluate any pending operation before chaining the next operator.
  if (state.accumulator !== null && state.operator !== null && !state.overwrite) {
    const result = evaluate(
      state.accumulator,
      state.operator,
      Number(state.display),
    )

    if (!Number.isFinite(result)) {
      return errorState()
    }

    // Accumulate the growing expression instead of collapsing to the result so
    // the display keeps showing `num1 + num2 + num3 ...` until `=`. The running
    // `result` is still stored so left-to-right arithmetic is unchanged.
    const expression = `${state.leftText ?? state.display} ${
      OPERATOR_LABELS[state.operator]
    } ${state.display}`

    return {
      display: state.display,
      leftText: expression,
      accumulator: result,
      operator,
      status: 'running',
      overwrite: true,
    }
  }

  const accumulator =
    state.accumulator !== null && state.operator !== null
      ? state.accumulator
      : Number(state.display)

  return {
    ...state,
    leftText: state.display,
    accumulator,
    operator,
    status: 'running',
    overwrite: true,
  }
}

function inputEquals(state: CalculatorState): CalculatorState {
  if (state.accumulator === null || state.operator === null) {
    return { ...state, leftText: null, status: 'complete', overwrite: true }
  }

  const result = evaluate(state.accumulator, state.operator, Number(state.display))

  if (!Number.isFinite(result)) {
    return errorState()
  }

  return {
    display: formatDisplay(result),
    leftText: null,
    accumulator: null,
    operator: null,
    status: 'complete',
    overwrite: true,
  }
}

function toggleSign(state: CalculatorState): CalculatorState {
  if (state.display === '0' || state.display === '0.') {
    return state
  }

  const display = state.display.startsWith('-')
    ? state.display.slice(1)
    : `-${state.display}`

  return { ...state, display }
}

function applyPercent(state: CalculatorState): CalculatorState {
  const result = Number(state.display) / 100

  if (!Number.isFinite(result)) {
    return errorState()
  }

  return { ...state, display: formatDisplay(result) }
}

function backspace(state: CalculatorState): CalculatorState {
  if (state.overwrite) {
    return state
  }

  const trimmed = state.display.slice(0, -1)
  const display = trimmed === '' || trimmed === '-' ? '0' : trimmed

  return { ...state, display }
}

export function reduce(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  // Any input after an error recovers to a clean state.
  if (state.status === 'error') {
    if (action.type === 'digit' || action.type === 'decimal') {
      return reduce({ ...initialState }, action)
    }
    return { ...initialState }
  }

  switch (action.type) {
    case 'digit':
      return inputDigit(state, action.value)
    case 'decimal':
      return inputDecimal(state)
    case 'operator':
      return inputOperator(state, action.value)
    case 'equals':
      return inputEquals(state)
    case 'clear':
      return { ...initialState }
    case 'sign':
      return toggleSign(state)
    case 'percent':
      return applyPercent(state)
    case 'backspace':
      return backspace(state)
  }
}

export type CalculatorKeyKind = 'digit' | 'operator' | 'action' | 'equals'

export interface CalculatorKey {
  /** Text rendered inside the button. */
  label: string
  /** Accessible name for the button. */
  ariaLabel: string
  /** Visual/behavioural grouping used for styling. */
  kind: CalculatorKeyKind
  /** Action dispatched when the button is pressed. */
  action: CalculatorAction
}

const DIGIT_KEYS: ReadonlyArray<CalculatorKey> = [
  { label: '7', ariaLabel: 'Seven', kind: 'digit', action: { type: 'digit', value: '7' } },
  { label: '8', ariaLabel: 'Eight', kind: 'digit', action: { type: 'digit', value: '8' } },
  { label: '9', ariaLabel: 'Nine', kind: 'digit', action: { type: 'digit', value: '9' } },
  { label: '4', ariaLabel: 'Four', kind: 'digit', action: { type: 'digit', value: '4' } },
  { label: '5', ariaLabel: 'Five', kind: 'digit', action: { type: 'digit', value: '5' } },
  { label: '6', ariaLabel: 'Six', kind: 'digit', action: { type: 'digit', value: '6' } },
  { label: '1', ariaLabel: 'One', kind: 'digit', action: { type: 'digit', value: '1' } },
  { label: '2', ariaLabel: 'Two', kind: 'digit', action: { type: 'digit', value: '2' } },
  { label: '3', ariaLabel: 'Three', kind: 'digit', action: { type: 'digit', value: '3' } },
  { label: '0', ariaLabel: 'Zero', kind: 'digit', action: { type: 'digit', value: '0' } },
]

const DIGIT_BY_VALUE = new Map(DIGIT_KEYS.map((key) => [key.label, key]))

function digitKey(value: string): CalculatorKey {
  const key = DIGIT_BY_VALUE.get(value)
  if (!key) {
    throw new Error(`Unknown calculator digit: ${value}`)
  }
  return key
}

/** Button grid, laid out row by row in a four-column grid. */
export const CALCULATOR_KEYS: readonly CalculatorKey[] = [
  { label: 'AC', ariaLabel: 'Clear', kind: 'action', action: { type: 'clear' } },
  { label: '±', ariaLabel: 'Toggle sign', kind: 'action', action: { type: 'sign' } },
  { label: '%', ariaLabel: 'Percent', kind: 'action', action: { type: 'percent' } },
  { label: '÷', ariaLabel: 'Divide', kind: 'operator', action: { type: 'operator', value: '÷' } },
  digitKey('7'),
  digitKey('8'),
  digitKey('9'),
  { label: '×', ariaLabel: 'Multiply', kind: 'operator', action: { type: 'operator', value: '×' } },
  digitKey('4'),
  digitKey('5'),
  digitKey('6'),
  { label: '−', ariaLabel: 'Subtract', kind: 'operator', action: { type: 'operator', value: '-' } },
  digitKey('1'),
  digitKey('2'),
  digitKey('3'),
  { label: '+', ariaLabel: 'Add', kind: 'operator', action: { type: 'operator', value: '+' } },
  digitKey('0'),
  { label: '.', ariaLabel: 'Decimal point', kind: 'digit', action: { type: 'decimal' } },
  { label: '⌫', ariaLabel: 'Backspace', kind: 'action', action: { type: 'backspace' } },
  { label: '=', ariaLabel: 'Equals', kind: 'equals', action: { type: 'equals' } },
]

/** Keyboard key → action, so physical keyboards drive the same reducer. */
export const KEYBOARD_MAP: Readonly<Record<string, CalculatorAction>> = {
  '0': { type: 'digit', value: '0' },
  '1': { type: 'digit', value: '1' },
  '2': { type: 'digit', value: '2' },
  '3': { type: 'digit', value: '3' },
  '4': { type: 'digit', value: '4' },
  '5': { type: 'digit', value: '5' },
  '6': { type: 'digit', value: '6' },
  '7': { type: 'digit', value: '7' },
  '8': { type: 'digit', value: '8' },
  '9': { type: 'digit', value: '9' },
  '.': { type: 'decimal' },
  ',': { type: 'decimal' },
  '+': { type: 'operator', value: '+' },
  '-': { type: 'operator', value: '-' },
  '*': { type: 'operator', value: '×' },
  x: { type: 'operator', value: '×' },
  X: { type: 'operator', value: '×' },
  '/': { type: 'operator', value: '÷' },
  '=': { type: 'equals' },
  Enter: { type: 'equals' },
  Escape: { type: 'clear' },
  c: { type: 'clear' },
  C: { type: 'clear' },
  Delete: { type: 'clear' },
  Backspace: { type: 'backspace' },
  '%': { type: 'percent' },
  n: { type: 'sign' },
  N: { type: 'sign' },
}
