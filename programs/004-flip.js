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
const data = [{x: [1, -1], y: [-1, 1]}]

const seed = Date.now()
const random = $$.createRandom(seed)

const init = ctx => {
  const in0 = $.Node({x: 0, y: 1})
  const in1 = $.Node({x: 0, y: 2})
  const split0 = $.Node({x: 1, y: 1})
  const split1 = $.Node({x: 1, y: 2})
  const outside0 = $.Node({x: 2, y: 0})
  const outside1 = $.Node({x: 2, y: 3})
  const uncross0 = $.Node({x: 2, y: 1})
  const uncross1 = $.Node({x: 2, y: 2})
  const join0 = $.Node({x: 3, y: 1})
  const join1 = $.Node({x: 3, y: 2})
  const out0 = $.Node({x: 4, y: 1})
  const out1 = $.Node({x: 4, y: 2})

  $.Attribute('weight', {value: () => 1})

  $.Flow(in0, split0)
  $.Flow(split0, outside0)
  $.Flow(split0, uncross0)
  $.Flow(split0, uncross1)
  $.Flow(uncross0, join0)
  $.Flow(outside0, join0)
  $.Flow(join0, out0)
  $.Flow(in1, split1)
  $.Flow(split1, outside1)
  $.Flow(split1, uncross1)
  $.Flow(split1, uncross0)
  $.Flow(uncross1, join1)
  $.Flow(outside1, join1)
  $.Flow(join1, out1)

  ctx.input = $.Boundary([in0, in1], {directionFixed: true, color: 'blue'})
  ctx.output = $.Boundary([out0, out1], {directionFixed: true, color: 'red'})
}

const program = loop({
  config,
  data,
  random,
  init
})

export default program
