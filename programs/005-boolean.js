import * as $ from '../core/lib'
import * as $$ from '../core/extra'
import loop from './loops/neuralNetworkPrototype'

const config = {
  predictionDelay: 10,
  transferRate: 0.5,
  cycleAspect: 0.1,
  cycleLeak: 0.1,
  valueDecay: 0.2,
  slopeDecay: 0.2,
  amplitude: 0.1
}
const data = [
  {x: [-1, -1], y: [-1]},
  {x: [1, -1], y: [1]},
  {x: [-1, 1], y: [1]},
  {x: [1, 1], y: [-1]}
]

const seed = Date.now()
const random = $$.createRandom(seed)

const init = ctx => {
  const input = $$.Line({x0: 0, y0: 1, x1: 0, y1: 2})
  const hidden0 = $$.Line({x0: 1, y0: 1, x1: 1, y1: 2})
  const hidden1 = $$.Line({x0: 2, y0: 1, x1: 2, y1: 2})
  const hidden2 = $$.Line({x0: 3, y0: 1, x1: 3, y1: 2})
  const output = $$.Line({x0: 3, y0: 1, x1: 3, y1: 1})

  $.Attribute('weight', {value: () => random(0, 1)})

  $.Flow(input, hidden0)
  $.Flow(hidden0, hidden1)
  $.Flow(hidden1, hidden2)
  $.Flow(hidden2, output)

  ctx.input = $.Boundary(input, {directionFixed: true, color: 'blue'})
  ctx.output = $.Boundary(output, {directionFixed: true, color: 'red'})

  const plusBias = $.Node({x: 1.5, y: 0})
  const minusBias = $.Node({x: 2.5, y: 0})
  const allHidden = [...hidden0, ...hidden1, ...hidden2]

  $.Flow(plusBias, allHidden)
  $.Flow(minusBias, allHidden)

  const biasStyle = {color: 'blue', shape: 'circle'}
  ctx.plusBias = $.Boundary(plusBias, {directionFixed: true, ...biasStyle})
  ctx.minusBias = $.Boundary(minusBias, {directionFixed: true, ...biasStyle})
}

const program = loop({
  config,
  data,
  random,
  init
})

export default program
