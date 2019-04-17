import * as $ from './lib'

const collides = (box, {x, y}) => {
  return (
    x > box.x && y > box.y && x < box.x + box.width && y < box.y + box.height
  )
}

const findClosestN = (origin, quadtree, n) => {
  const {x, y} = origin
  let size = 8
  let closest
  while (size < Math.max(quadtree.width, quadtree.height) * 2) {
    closest = quadtree.colliding(
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
  return closest.slice(0, n)
}

const Jumble = () => {
  const options = {}
  for (const i in subCommands) {
    const [command, ...params] = subCommands[i]
    switch (command) {
      case 'NODE_COUNT':
      case 'FLOWS_PER_NODE': {
        const key = camelCase(command)
        const [value] = params
        options[key] = parseFloat(value, 10)
        break
      }
      case 'TOP_LEFT':
      case 'BOTTOM_RIGHT':
      case 'WEIGHT': {
        const key = camelCase(command)
        const [value] = params
        options[key] = value
        break
      }
    }
  }

  const {topLeft, bottomRight, nodeCount, flowsPerNode, weight} = options
  const [x1, y1] = topLeft.split(',').map(v => parseFloat(v, 10))
  const [x2, y2] = bottomRight.split(',').map(v => parseFloat(v, 10))
  const jumbleNodes = []
  for (let j = 0; j < nodeCount; j++) {
    const x = random(0, 1) * (x2 - x1) + x1
    const y = random(0, 1) * (y2 - y1) + y1
    const label = `${x},${y}`
    const i = nodes.length
    const n = {label, i, x, y, flows: []}
    nodes.push(n)
    jumbleNodes.push(n)
  }

  var quadtree = new Quadtree({
    width: config.width,
    height: config.height
  })
  quadtree.pushAll(jumbleNodes)

  jumbleNodes.forEach((node, i) => {
    const closest = findClosestN(node, quadtree, flowsPerNode)
    closest.forEach(neighbour => {
      const w = eval(weight)
      const i = flows.length
      const a = node.label
      const b = neighbour.label
      if (
        node.flows.some(i => flows[i].a === b && flows[i].b === a) ||
        neighbour.flows.some(i => flows[i].a === b && flows[i].b === a)
      ) {
        return
      }
      flows.push({i, a, b, w, v: 0, s: 0})
    })
  })
}

export default Jumble
