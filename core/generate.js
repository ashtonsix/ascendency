import MersenneTwister from 'mersenne-twister'
import * as Quadtree from 'quadtree-lib'

const splitArray = (arr, match) => {
  const next = []
  let buffer = []
  arr.forEach(value => {
    if (value === match) {
      if (buffer.length) next.push(buffer)
      buffer = []
    } else {
      buffer.push(value)
    }
  })
  if (buffer.length) next.push(buffer)
  return next
}

const tokenise = program => {
  const commands = []
  let blockBuffer = []
  let commandBuffer = []
  blockBuffer.push(commandBuffer)
  let tokenBuffer = ''
  let comment = false
  let string = false
  let block = false
  for (const i in program) {
    const c = program[i]

    if (c === '#') comment = true
    if (comment && c !== '\n') continue

    if (/[^\s`#{}]/.test(c) || (c === ' ' && string)) {
      tokenBuffer += c
      continue
    }
    if (c === '`') {
      string = !string
      continue
    }
    if (c === ' ' && !string) {
      if (tokenBuffer) {
        commandBuffer.push(tokenBuffer)
        tokenBuffer = ''
      }
      continue
    }
    if (c === '{') {
      block = true
      continue
    }
    if (c === '}') {
      block = false
      continue
    }
    if (c === '\n') {
      comment = false
      string = false
      if (tokenBuffer) {
        commandBuffer.push(tokenBuffer)
        tokenBuffer = ''
      }
      if (commandBuffer.length && block) {
        commandBuffer.push('BLOCK_NEWLINE')
      }
      if (commandBuffer.length && !block) {
        commands.push(commandBuffer)
        commandBuffer = []
      }
      continue
    }
  }

  for (const i in commands) {
    commands[i] = splitArray(commands[i], 'BLOCK_NEWLINE')
  }

  return commands
}

const createRandom = seed => {
  const twister = new MersenneTwister(seed)
  const random = (lo, hi) => twister.random() * (hi - lo) + lo
  return random
}

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

const intepret = commands => {
  let random = createRandom(Date.now()) // usage: eval(`random(0, -1)`)
  const config = {}
  const flows = []
  const nodes = []
  const inputs = []
  const outputs = []
  const plusBias = []
  const minusBias = []
  const data = []
  const vectors = {}
  for (const i in commands) {
    const [[command, ...params], ...subCommands] = commands[i]
    const camelCase = str => {
      str = str.toLowerCase()
      str = str.replace(/_\w/g, c => c[1].toUpperCase())
      return str
    }
    switch (command) {
      case 'CONFIG': {
        for (const i in subCommands) {
          const [command, ...params] = subCommands[i]
          switch (command) {
            case 'WIDTH':
            case 'HEIGHT':
            case 'PREDICTION_DELAY':
            case 'AMPLITUDE':
            case 'TRANSFER_RATE':
            case 'CYCLE_ASPECT':
            case 'CYCLE_LEAK':
            case 'VALUE_DECAY':
            case 'SLOPE_DECAY': {
              const key = camelCase(command)
              const [value] = params
              config[key] = parseFloat(value, 10)
              break
            }
            case 'ACTIVATE':
            case 'AMPLIFY': {
              const key = camelCase(command)
              const [value] = params
              config[key] = value
              break
            }
          }
        }
        break
      }
      case 'SEED': {
        let [seed] = params
        seed = eval(seed)
        random = createRandom(seed)
        break
      }
      case 'NODE': {
        let [label, location, flag] = params
        const i = nodes.length
        const [x, y] = location.split(',').map(v => parseFloat(v, 10))
        nodes.push({label, i, x, y, flows: []})
        if (flag === 'INPUT') inputs.push(i)
        if (flag === 'OUTPUT') outputs.push(i)
        if (flag === 'PLUS_BIAS') plusBias.push(i)
        if (flag === 'MINUS_BIAS') minusBias.push(i)
        break
      }
      case 'FLOW': {
        let [a, b, w] = params
        const i = flows.length
        w = eval(w)
        flows.push({i, a, b, w, v: 0, s: 0})
        break
      }
      case 'VECTOR': {
        let [vector, topLeft, bottomRight, flag] = params
        vectors[vector] = []
        const [x1, y1] = topLeft.split(',').map(v => parseFloat(v, 10))
        const [x2, y2] = bottomRight.split(',').map(v => parseFloat(v, 10))
        if (x1 !== x2 && y1 !== y2) throw new Error('vector must be flat')
        // prettier-ignore
        const size = (y2 - y1) + (x2 - x1)
        for (let j = 0; j <= size; j++) {
          const label = `${vector},${j}`
          const i = nodes.length
          let x = x1
          let y = y1
          if (x1 !== x2) x += j
          if (y1 !== y2) y += j
          nodes.push({label, i, x, y, flows: []})
          if (flag === 'INPUT') inputs.push(i)
          if (flag === 'OUTPUT') outputs.push(i)
          if (flag === 'PLUS_BIAS') plusBias.push(i)
          if (flag === 'MINUS_BIAS') minusBias.push(i)
          vectors[vector].push(label)
        }
      }
      case 'LINEAR': {
        let [va, vb, weight] = params
        va = vectors[va]
        vb = vectors[vb]
        for (const j in va) {
          for (const k in vb) {
            const w = eval(weight)
            const i = flows.length
            const a = va[j]
            const b = vb[k]
            flows.push({i, a, b, w, v: 0, s: 0})
          }
        }
      }
      case 'GRID': {
        let [topLeft, bottomRight, weight] = params
        const [x1, y1] = topLeft.split(',').map(v => parseFloat(v, 10))
        const [x2, y2] = bottomRight.split(',').map(v => parseFloat(v, 10))
        for (let x = x1; x <= x2; x++) {
          for (let y = y1; y <= y2; y++) {
            const label = `${x},${y}`
            const i = nodes.length
            nodes.push({label, i, x, y, flows: []})
            if (x < x2) {
              const w = eval(weight)
              const i = flows.length
              const a = `${x},${y}`
              const b = `${x + 1},${y}`
              flows.push({i, a, b, w, v: 0, s: 0})
            }
            if (y < y2) {
              const w = eval(weight)
              const i = flows.length
              const a = `${x},${y}`
              const b = `${x},${y + 1}`
              flows.push({i, a, b, w, v: 0, s: 0})
            }
          }
        }
        break
      }
      case 'JUMBLE': {
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
        break
      }
      case 'DATA': {
        let datums = subCommands
        datums.forEach(([x, y]) => {
          x = x.split(',').map(v => parseFloat(v, 10))
          y = y.split(',').map(v => parseFloat(v, 10))
          data.push([x, y])
        })
        break
      }
      default: {
        break
      }
    }
  }

  if (typeof config.slopeDecay !== 'number') config.slopeDecay = 0

  const nodeMap = {}
  nodes.forEach(n => {
    nodeMap[n.label] = n
  })
  flows.forEach(f => {
    f.a = nodeMap[f.a].i
    f.b = nodeMap[f.b].i
    if (inputs.includes(f.a) && nodes[f.a].flows.length) {
      throw new Error('input cannot have more than one flow')
    }
    if (outputs.includes(f.b) && nodes[f.b].flows.length) {
      throw new Error('output cannot have more than one flow')
    }
    nodes[f.a].flows.push(f.i)
    nodes[f.b].flows.push(f.i)
  })

  return {
    config,
    flows,
    nodes,
    inputs,
    outputs,
    plusBias,
    minusBias,
    data,
    time: 0
  }
}

const generate = program => {
  const commands = tokenise(program)
  const world = intepret(commands)
  return world
}

export default generate
