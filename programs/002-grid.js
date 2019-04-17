import * as $ from '../core/lib'
import * as $$ from '../core/extra'
import loop from './loops/weightOnly'

const config = {
  transferRate: 0.5,
  leakRate: 0.001
}

const seed = Date.now()
const random = $$.createRandom(seed)

const init = ctx => {
  $$.Grid({x0: 0, y0: 0, x1: 7, y1: 7})
}

const program = loop({
  config,
  random,
  init
})

export default program
