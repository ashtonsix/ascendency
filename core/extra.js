import MersenneTwister from 'mersenne-twister'
import * as Quadtree from 'quadtree-lib'
import * as $ from './lib'
import Jumble from './jumble'

const createRandom = seed => {
  const twister = new MersenneTwister(seed)
  const random = (lo, hi) => twister.random() * (hi - lo) + lo
  return random
}

const activate = v => {
  // precise = 1.1996786402577338339163698
  const norm = 1.199678640257733
  return Math.tanh(v * norm) * norm
}

const errorToAmplify = (error, domain) => {
  const [lo, hi] = domain
  error += 1 / (hi - lo)
  const amplify = 1 / error + lo
  return amplify
}

const error = (a, b) => {
  let total = 0
  a.forEach((_, i) => (total += Math.abs(a[i] - b[i]) ** 2))
  const error = total / a.length
  return error
}

const amplify = (a, b, amplitude) => {
  return errorToAmplify(error(a, b), [1, 1 + amplitude])
}

// nodes only
const Line = ({x0, y0, x1, y1, spacing = 1}) => {
  let yy, xx
  const slope = (y1 - y0) / (x1 - x0)
  if (slope === Infinity) {
    yy = 1
    xx = 0
  } else if (!slope) {
    yy = 0
    xx = 1
  } else {
    yy = (slope ** 2 / (slope ** 2 + 1)) ** 0.5
    xx = (1 / (slope ** 2 + 1)) ** 0.5
  }
  yy *= spacing
  xx *= spacing

  let x = x0
  let y = y0
  const n = []
  while (x <= x1 && y <= y1) {
    n.push($.Node({x, y}))
    x += xx
    y += yy
  }
  return n
}

// nodes & flows
const Grid = ({x0, y0, x1, y1, spacing = 1}, attrs) => {
  const nodes = {}
  for (let x = x0; x <= x1; x += spacing) {
    nodes[x] = {}
    for (let y = y0; y <= y1; y += spacing) {
      nodes[x][y] = $.Node({x, y})
    }
  }
  for (let x = x0; x <= x1; x += spacing) {
    for (let y = y0; y <= y1; y += spacing) {
      const a = nodes[x][y]
      const bx = []
      if (x + spacing <= x1) bx.push(nodes[x + spacing][y])
      if (y + spacing <= y1) bx.push(nodes[x][y + spacing])
      bx.forEach(b => $.Flow(a, b, attrs))
    }
  }
}

const phased = (time, ...args) => {
  let testLo
  let testHi = 0
  let tick = time % args.reduce((pv, v) => pv + (+v || 0), 0)
  for (let i = 0; i < args.length; i += 2) {
    const phaseLength = args[i]
    const phase = args[i + 1]
    testLo = testHi
    testHi += phaseLength
    if (tick >= testLo && tick < testHi) return phase()
  }
}

export {createRandom, activate, amplify, Line, Grid, Jumble, phased}
