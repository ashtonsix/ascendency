import React from 'react'
import MersenneTwister from 'mersenne-twister'
import * as Quadtree from 'quadtree-lib'
import useClock from './useClock'
import './arrow'

// node = {i, x, y}
// exchange = {i, ni, nj, sz, backward: exchange, forward: [exchange]}

const config = {
  world_height: 800,
  world_width: 800,
  num_nodes: 900,
  exchanges_per_node: 4,
  exchanges_variation: 0.5,
  seed: Date.now()
}

const Canvas = ({world}) => {
  const {nodes = [], exchanges = [], exchangePairs = []} = world
  const ref = React.useRef()

  React.useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, config.world_width, config.world_height)

    ctx.fillStyle = 'black'
    exchangePairs.forEach(([i, j]) => {
      i = exchanges[i]
      j = exchanges[j]
      const {x: xi, y: yi} = nodes[i.ni]
      const {x: xj, y: yj} = nodes[i.nj]
      ctx.beginPath()
      const w0 = j ? Math.max(j.sz, 0) : 0
      const w1 = Math.max(i.sz, 0)
      ctx.arrow(xi, yi, xj, yj, [2, w0, -2, w1])
      ctx.fill()
    })
  })

  return (
    <canvas height={config.world_height} width={config.world_width} ref={ref} />
  )
}

const findPairs = exchanges => {
  const map = {}
  const pairs = []
  exchanges.forEach(({ni, nj}, i) => {
    const key = ni > nj ? `${ni}-${nj}` : `${nj}-${ni}`
    if (typeof map[key] === 'number') {
      pairs.push([map[key], i])
      delete map[key]
    } else {
      map[key] = i
    }
  })
  Object.values(map).forEach(i => pairs.push([i, -1]))
  return pairs
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

const randomNodes = ({num_nodes, world_height, world_width, random}) => {
  const nodes = []
  for (let i = 0; i < num_nodes; i++) {
    const x = Math.floor(random() * world_width)
    const y = Math.floor(random() * world_height)
    nodes.push({i, x, y})
  }
  return nodes
}

const squareNodes = ({num_nodes, world_height, world_width, random}) => {
  const nodes = []
  for (let i = 0; i < num_nodes; i++) {
    const sz = Math.floor(num_nodes ** 0.5)
    const x = ((i % sz) / sz) * (world_width - 20) + random() + 10
    const y = (Math.floor(i / sz) / sz) * (world_height - 20) + random() + 10
    nodes.push({i, x, y})
  }
  return nodes
}

const basicNode = () => {
  return [
    {i: 0, x: 200, y: 200},
    {i: 1, x: 400, y: 200},
    {i: 2, x: 200, y: 400},
    {i: 3, x: 400, y: 400}
  ]
}

const init = () => {
  const {
    world_height,
    world_width,
    num_nodes,
    exchanges_per_node,
    exchanges_variation,
    seed
  } = config

  const generator = new MersenneTwister(seed)
  const random = generator.random.bind(generator)

  const nodes = squareNodes({num_nodes, world_height, world_width, random})

  var quadtree = new Quadtree({
    width: world_width,
    height: world_height
  })
  quadtree.pushAll(nodes)

  const exchanges = []
  nodes.forEach((node, i) => {
    const closest = findClosestN(node, quadtree, exchanges_per_node)
    closest.forEach(neighbour => {
      const sz = 1 - exchanges_variation + random() * exchanges_variation * 2
      exchanges.push({i: exchanges.length, ni: node.i, nj: neighbour.i, sz})
    })
  })

  // because of geometry, it may be impossible for each node to have the same
  // # of bidirectional exchanges. for randomly positioned nodes, nodes will
  // have a mean of ~50% more nodes than specified in the config with our
  // algorithm
  const exchangePairs = findPairs(exchanges)
  exchangePairs.forEach(([i, j], idx) => {
    i = exchanges[i]
    j = exchanges[j]
    if (!j) {
      const sz = 1 - exchanges_variation + random() * exchanges_variation * 2
      j = {i: exchanges.length, ni: i.nj, nj: i.ni, sz}
      exchangePairs[idx][1] = exchanges.length
      exchanges.push(j)
    }
  })

  const iHashmap = {}
  exchanges.forEach(e => {
    if (!iHashmap[e.ni]) iHashmap[e.ni] = []
    iHashmap[e.ni].push(e)
  })
  exchanges.forEach(e => {
    e.forward = []
    iHashmap[e.nj].forEach(e2 => {
      if (e2.nj === e.ni) e.backward = e2
      else e.forward.push(e2)
    })
  })

  return {
    random,
    nodes,
    exchanges,
    exchangePairs // for drawing
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

A' <---*

exchange A strengthens B, C, D & E; while weakening A'
repeated each iteration for each exchange
*/
const loop = ({random, nodes, exchanges, exchangePairs}) => {
  const delta = {}
  exchanges.forEach(e => {
    const forward = ((e.sz - e.backward.sz) * e.backward.sz) / 100
    if (forward > 0) {
      if (!delta[e.backward.i]) delta[e.backward.i] = 0
      delta[e.backward.i] -= forward
      if (!delta[e.i]) delta[e.i] = 0

      const iForward = forward / e.forward.length
      const forwardAvg =
        e.forward.map(e => e.sz).reduce((pv, v) => pv + v, 0) / e.forward.length
      e.forward.forEach(e => {
        if (!delta[e.i]) delta[e.i] = 0
        delta[e.i] += iForward * (e.sz / forwardAvg)
      })
    }
  })

  Object.keys(delta).forEach(i => {
    exchanges[i].sz += delta[i]
  })

  return {
    random,
    nodes,
    exchanges,
    exchangePairs
  }
}

let world = init()
global.world = world

const Home = () => {
  useClock({
    loop: () => {
      world = loop(world)
    }
  })
  return (
    <div>
      <h1>Ascendency</h1>
      <Canvas world={world} />
    </div>
  )
}

export default Home
