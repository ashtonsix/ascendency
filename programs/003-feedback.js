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
const data = [{x: [1], y: [1, 1]}]

const seed = Date.now()
const random = $$.createRandom(seed)

const init = ctx => {
  const i0 = $.Node({x: 0, y: 2})
  const o0 = $.Node({x: 6, y: 1})
  const o1 = $.Node({x: 6, y: 3})

  $$.Grid({x0: 1, y0: 0, x1: 5, y1: 4})

  $.selectIndex({width: 6, height: 4})
  $.Flow(i0, $.select({x: 1, y: 2}), {weight: random(0, 1)})
  $.Flow($.select({x: 5, y: 1}), o0, {weight: random(0, 1)})
  $.Flow($.select({x: 5, y: 3}), o1, {weight: random(0, 1)})

  ctx.input = $.Boundary([i0], {directionFixed: true, color: 'blue'})
  ctx.output = $.Boundary([o0, o1], {directionFixed: true, color: 'red'})
}

const program = loop({
  config,
  data,
  random,
  init
})

export default program
