import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CALCULATOR_KEYS,
  KEYBOARD_MAP,
  evaluate,
  formatDisplay,
  initialState,
  reduce,
  screenText,
} from '#/lib/calculator.ts'
import type {
  CalculatorAction,
  CalculatorState,
} from '#/lib/calculator.ts'

function run(actions: readonly CalculatorAction[]): CalculatorState {
  return actions.reduce(reduce, initialState)
}

function digit(value: string): CalculatorAction {
  return { type: 'digit', value }
}

function operator(value: '+' | '-' | '×' | '÷'): CalculatorAction {
  return { type: 'operator', value }
}

test('enters digits sequentially, ignoring leading zeros', () => {
  const sequential = run([digit('1'), digit('2')])
  assert.equal(sequential.display, '12')

  const leadingZero = run([digit('0'), digit('5')])
  assert.equal(leadingZero.display, '5')
})

test('adds two operands on equals', () => {
  const state = run([digit('2'), operator('+'), digit('3'), { type: 'equals' }])
  assert.equal(state.display, '5')
  assert.equal(state.status, 'complete')
  assert.equal(state.operator, null)
  assert.equal(state.accumulator, null)
})

test('chains operators by evaluating the pending operation', () => {
  const interim = run([digit('2'), operator('+'), digit('3'), operator('×')])
  assert.equal(interim.display, '5')
  assert.equal(interim.status, 'running')
  assert.equal(interim.operator, '×')

  const resolved = run([
    digit('2'),
    operator('+'),
    digit('3'),
    operator('×'),
    digit('4'),
    { type: 'equals' },
  ])
  assert.equal(resolved.display, '20')
})

test('rejects a second decimal point in the same operand', () => {
  const state = run([
    digit('1'),
    { type: 'decimal' },
    { type: 'decimal' },
    digit('5'),
  ])
  assert.equal(state.display, '1.5')
})

test('decimal starts a fresh operand after a result', () => {
  const state = run([digit('7'), { type: 'decimal' }])
  assert.equal(state.display, '7.')
})

test('division by zero produces the error state', () => {
  const state = run([digit('1'), operator('÷'), digit('0'), { type: 'equals' }])
  assert.equal(state.display, 'Error')
  assert.equal(state.status, 'error')
})

test('any digit after an error recovers to fresh input', () => {
  const state = run([
    digit('1'),
    operator('÷'),
    digit('0'),
    { type: 'equals' },
    digit('7'),
  ])
  assert.equal(state.display, '7')
  assert.equal(state.status, 'idle')
  assert.equal(state.accumulator, null)
  assert.equal(state.operator, null)
})

test('clear resets to the initial state', () => {
  const state = run([
    digit('9'),
    operator('+'),
    digit('1'),
    { type: 'clear' },
  ])
  assert.deepEqual(state, initialState)
})

test('sign toggles the polarity of the display', () => {
  assert.equal(run([digit('5'), { type: 'sign' }]).display, '-5')
  assert.equal(
    run([digit('5'), { type: 'sign' }, { type: 'sign' }]).display,
    '5',
  )
  assert.equal(run([digit('0'), { type: 'sign' }]).display, '0')
})

test('percent divides the display by one hundred', () => {
  assert.equal(run([digit('5'), digit('0'), { type: 'percent' }]).display, '0.5')
})

test('backspace removes the last character and floors at zero', () => {
  assert.equal(
    run([digit('1'), digit('2'), digit('3'), { type: 'backspace' }]).display,
    '12',
  )
  assert.equal(run([digit('1'), { type: 'backspace' }]).display, '0')
})

test('evaluate applies each operator', () => {
  assert.equal(evaluate(6, '+', 2), 8)
  assert.equal(evaluate(6, '-', 2), 4)
  assert.equal(evaluate(6, '×', 2), 12)
  assert.equal(evaluate(6, '÷', 2), 3)
  assert.ok(Number.isNaN(evaluate(1, '÷', 0)))
})

test('formatDisplay removes floating-point noise', () => {
  assert.equal(formatDisplay(0.1 + 0.2), '0.3')
  assert.equal(formatDisplay(0.3 - 0.1), '0.2')
  assert.equal(formatDisplay(1 / 3), '0.333333333333')
  assert.equal(formatDisplay(Number.POSITIVE_INFINITY), 'Error')
  assert.equal(formatDisplay(Number.NaN), 'Error')
})

test('screenText shows the full pending expression', () => {
  assert.equal(screenText(initialState), '0')
  assert.equal(screenText(run([digit('3')])), '3')
  assert.equal(screenText(run([digit('3'), operator('+')])), '3 +')
  assert.equal(screenText(run([digit('3'), operator('+'), digit('5')])), '3 + 5')
  assert.equal(
    screenText(run([digit('3'), operator('+'), digit('5'), { type: 'equals' }])),
    '8',
  )
})

test('screenText reflects chaining, decimals, glyphs and backspace', () => {
  assert.equal(
    screenText(run([digit('2'), operator('+'), digit('3'), operator('×')])),
    '5 ×',
  )
  assert.equal(
    screenText(run([digit('3'), operator('+'), { type: 'decimal' }])),
    '3 + 0.',
  )
  assert.equal(
    screenText(run([digit('7'), operator('-'), digit('2')])),
    '7 − 2',
  )
  assert.equal(
    screenText(
      run([digit('3'), operator('+'), digit('5'), { type: 'backspace' }]),
    ),
    '3 + 0',
  )
})

test('screenText collapses to the sentinel and resets on clear', () => {
  assert.equal(
    screenText(
      run([digit('1'), operator('÷'), digit('0'), { type: 'equals' }]),
    ),
    'Error',
  )
  assert.equal(
    screenText(
      run([digit('9'), operator('+'), digit('1'), { type: 'clear' }]),
    ),
    '0',
  )
})

test('reduce is pure and never mutates the input state', () => {
  const snapshot = JSON.stringify(initialState)
  run([
    digit('2'),
    operator('+'),
    digit('3'),
    { type: 'equals' },
    { type: 'sign' },
  ])
  assert.equal(JSON.stringify(initialState), snapshot)
})

const VALID_ACTION_TYPES = new Set<CalculatorAction['type']>([
  'digit',
  'decimal',
  'operator',
  'equals',
  'clear',
  'sign',
  'percent',
  'backspace',
])

test('calculator key contract matches the keyboard map', () => {
  const digitValues: string[] = []

  for (const key of CALCULATOR_KEYS) {
    assert.ok(key.label.length > 0, 'every button has a visible label')
    assert.ok(key.ariaLabel.length > 0, 'every button has an aria-label')
    assert.ok(
      VALID_ACTION_TYPES.has(key.action.type),
      `button "${key.label}" dispatches a valid action`,
    )

    if (key.action.type === 'digit') {
      digitValues.push(key.action.value)
    }
  }

  assert.deepEqual(
    [...digitValues].sort(),
    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    'the grid exposes every digit exactly once',
  )

  for (const [keyboardKey, action] of Object.entries(KEYBOARD_MAP)) {
    assert.ok(
      VALID_ACTION_TYPES.has(action.type),
      `keyboard key "${keyboardKey}" maps to a valid action`,
    )
  }

  const keyboardActionTypes = new Set(
    Object.values(KEYBOARD_MAP).map((action) => action.type),
  )

  for (const actionType of new Set(CALCULATOR_KEYS.map((key) => key.action.type))) {
    assert.ok(
      keyboardActionTypes.has(actionType),
      `action "${actionType}" is reachable from the keyboard`,
    )
  }
})
