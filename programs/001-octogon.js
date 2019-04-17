import * as $ from '../core/lib'
import * as $$ from '../core/extra'
import loop from './loops/weightOnly'

const config = {
  transferRate: 0.5,
  leakRate: 0.1
}

const seed = Date.now()
const random = $$.createRandom(seed)

const init = ctx => {
  const tx = 0.5 ** 0.5 // height of perfect right-angled triangle
  const a = $.Node({x: tx * 1 + 0, y: tx * 0 + 0})
  const b = $.Node({x: tx * 1 + 1, y: tx * 0 + 0})
  const c = $.Node({x: tx * 2 + 1, y: tx * 1 + 0})
  const d = $.Node({x: tx * 2 + 1, y: tx * 1 + 1})
  const e = $.Node({x: tx * 1 + 1, y: tx * 2 + 1})
  const f = $.Node({x: tx * 1 + 0, y: tx * 2 + 1})
  const g = $.Node({x: tx * 0 + 0, y: tx * 1 + 1})
  const h = $.Node({x: tx * 0 + 0, y: tx * 1 + 0})

  $.Flow(a, b)
  $.Flow(b, c)
  $.Flow(c, d)
  $.Flow(d, e)
  $.Flow(e, f)
  $.Flow(f, g)
  $.Flow(g, h)
  $.Flow(h, a)
}

const program = loop({
  config,
  random,
  init
})

export default program
