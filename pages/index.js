import React from 'react'
import MersenneTwister from 'mersenne-twister'
import * as Quadtree from 'quadtree-lib'
import useClock from './useClock'
import './arrow'

// node = {i, x, y, a: [], b: []}
// exchange = {i, a, b, f}
// "f" is flow from a to b

const generators = {
  random: ({num_nodes, world_height, world_width, random}) => {
    const nodes = []
    for (let i = 0; i < num_nodes; i++) {
      const x = Math.floor(random() * world_width)
      const y = Math.floor(random() * world_height)
      nodes.push({i, x, y})
    }
    return nodes
  },
  square: ({num_nodes, world_height, world_width, random}) => {
    const nodes = []
    for (let i = 0; i < num_nodes; i++) {
      const sz = Math.floor(num_nodes ** 0.5)
      const x = ((i % sz) / sz) * (world_width - 20) + random() + 10
      const y = (Math.floor(i / sz) / sz) * (world_height - 20) + random() + 10
      nodes.push({i, x, y})
    }
    return nodes
  },
  basic: () => {
    return [
      {i: 0, x: 200, y: 200},
      {i: 1, x: 400, y: 200},
      {i: 2, x: 200, y: 400},
      {i: 3, x: 400, y: 400}
    ]
  }
}

const config = {
  world_height: 800,
  world_width: 800,
  num_nodes: 400,
  node_generator: 'square',
  exchanges_per_node: 4,
  disipation: 0.01,
  arrow_size: 4,
  seed: Date.now()
}

global.config = config

const shrink = v => {
  const sgn = v > 0 ? 1 : -1
  v = Math.log10(Math.abs(v) + 1)
  return v * sgn
}

const Canvas = ({world}) => {
  const {nodes = [], exchanges = []} = world
  const ref = React.useRef()

  React.useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, config.world_width, config.world_height)

    ctx.fillStyle = 'black'

    const max = shrink(
      exchanges.reduce((pv, e) => Math.max(pv, Math.abs(e.f)), 0)
    )

    exchanges.forEach(({a, b, f}) => {
      const {x: xa, y: ya} = nodes[a]
      const {x: xb, y: yb} = nodes[b]
      f = (shrink(f) / max) * config.arrow_size

      const shape = f > 0 ? [1, 0, -f * 2, f] : [-f * 2, -f, -1, 0]
      ctx.beginPath()
      ctx.arrow(xa, ya, xb, yb, shape)
      ctx.fill()
    })
  })

  return (
    <canvas height={config.world_height} width={config.world_width} ref={ref} />
  )
}

const collides = (box, {x, y}) => {
  return (
    x > box.x && y > box.y && x < box.x + box.width && y < box.y + box.height
  )
}

const findClosestN = (origin, quadtree, n) => {
  const {x, y} = origin
  let size = 8
  while (size < Math.max(quadtree.width, quadtree.height) * 2) {
    const closest = quadtree.colliding(
      {
        x: x - size / 2,
        y: y - size / 2,
        width: size,
        height: size
      },
      collides
    )
    size *= 2
    if (closest.length > n) {
      // taxicab distance
      closest.sort((a, b) => {
        const da = Math.abs(a.x - x) + Math.abs(a.y - y)
        const db = Math.abs(b.x - x) + Math.abs(b.y - y)
        return da - db
      })
      // filter nodes in same location
      closest = closest.filter(n => {
        const d = Math.abs(n.x - x) + Math.abs(n.y - y)
        return d > 0
      })
      return closest.slice(0, n)
    }
  }
}

const init = () => {
  const {
    world_height,
    world_width,
    num_nodes,
    exchanges_per_node,
    seed
  } = config

  const generator = new MersenneTwister(seed)
  const random = generator.random.bind(generator)

  const nodeGen = generators[config.node_generator]
  const nodes = nodeGen({num_nodes, world_height, world_width, random})
  nodes.forEach(n => {
    n.a = []
    n.b = []
  })

  var quadtree = new Quadtree({
    width: world_width,
    height: world_height
  })
  quadtree.pushAll(nodes)

  const exchanges = []
  nodes.forEach((node, i) => {
    const closest = findClosestN(node, quadtree, exchanges_per_node)
    closest.forEach(neighbour => {
      const i = exchanges.length
      const a = node.i
      const b = neighbour.i
      // skip if an exchange already exists along the same path
      if (
        nodes[a].a.some(i => exchanges[i].a === b && exchanges[i].b === a) ||
        nodes[a].b.some(i => exchanges[i].a === b && exchanges[i].b === a) ||
        nodes[b].a.some(i => exchanges[i].a === b && exchanges[i].b === a) ||
        nodes[b].b.some(i => exchanges[i].a === b && exchanges[i].b === a)
      ) {
        return
      }
      const f = random() - 0.5
      exchanges.push({i, a, b, f})
      node.a.push(i)
      neighbour.b.push(i)
    })
  })
  exchanges.forEach(({i, a, b}) => {
    if (!nodes[a].a.includes(i)) nodes[a].a.push(i)
    if (!nodes[a].b.includes(i)) nodes[a].b.push(i)
    if (!nodes[b].a.includes(i)) nodes[b].a.push(i)
    if (!nodes[b].b.includes(i)) nodes[b].b.push(i)
  })

  // flip negative vlow exchanges, to simplify code
  exchanges.forEach(e => {
    if (e.f < 0) {
      const a = e.a
      e.a = e.b
      e.b = a
      e.f *= -1
    }
  })

  let total = 0
  exchanges.forEach(e => (total += Math.abs(e.f)))
  let normalise = 1 / (total / exchanges.length)
  exchanges.forEach(e => (e.f *= normalise))

  return {
    random,
    nodes,
    exchanges
  }
}

/*
       B
       ^    C
       |   ^
A ---> * -/ 
      / \
     v  v
    D   E

a fraction of exchange A's flow is transferred to B, C, D & E each iteration.
the amount transferred to each target is weighted by their outgoing flow
*/
const format = (e, ef, d) =>
  `from ${e.a} -> ${e.b} to ${ef.a} -> ${ef.b}, transfer ${d}`
const loop = ({random, nodes, exchanges}) => {
  // calculate deltas
  const delta = new Array(exchanges.length).fill(0)
  exchanges.forEach((e, i) => {
    let d = Math.abs(e.f / 5)
    let sum = 0
    const forward = []
    delta[e.i] -= d
    nodes[e.b].a.forEach(n => {
      const ef = exchanges[n]
      if (ef.i === e.i) return
      const backward = ef.b === e.a || ef.b === e.b
      if (!backward) sum += ef.f
      forward.push(ef)
    })

    const allBackward = sum === 0
    forward.forEach(ef => {
      const backward = ef.b === e.a || ef.b === e.b
      const df = allBackward
        ? -d / forward.length
        : backward
        ? 0
        : d * Math.abs(ef.f / sum)
      // console.log(format(e, ef, df))
      delta[ef.i] += df
    })
  })

  // console.log('---')

  // apply deltas
  Object.keys(delta).forEach(i => {
    const e = exchanges[i]
    e.f += delta[i]
    // flip negative flow exchanges, to simplify code
    if (e.f < 0) {
      const a = e.a
      e.a = e.b
      e.b = a
      e.f *= -1
    }
  })

  // normalisation
  let total = 0
  exchanges.forEach(e => (total += Math.abs(e.f)))
  let normalise = 1 / (total / exchanges.length)
  exchanges.forEach(e => (e.f *= normalise))

  // disipation
  exchanges.forEach(e => {
    const dis = config.disipation
    const add = (total * dis) / exchanges.length
    const sub = Math.abs(e.f * dis)
    let d = add - sub
    if (e.f < 0) d *= -1
    e.f += d
  })

  return {random, nodes, exchanges}
}

const Home = () => {
  const [world, setWorld] = React.useState(init())
  const clock = useClock(() => setWorld(loop(world)), 16, true)
  global.world = world
  global.clock = clock
  return (
    <div>
      <h1>Ascendency</h1>
      <Canvas world={world} />
    </div>
  )
}

export default Home
