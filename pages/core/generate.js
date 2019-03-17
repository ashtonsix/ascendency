import MersenneTwister from 'mersenne-twister'

const tokenise = program => {
  const commands = []
  let commandBuffer = []
  let tokenBuffer = ''
  let string = false
  for (const i in program) {
    const c = program[i]
    if (/[^\s`]/.test(c) || (c === ' ' && string)) {
      tokenBuffer += c
      continue
    }
    if (c === '`') {
      string = !string
      continue
    }
    if (c === ' ' && !string) {
      commandBuffer.push(tokenBuffer)
      tokenBuffer = ''
      continue
    }
    if (c === '\n') {
      string = false
      commandBuffer.push(tokenBuffer)
      tokenBuffer = ''
      commands.push(commandBuffer)
      commandBuffer = []
      continue
    }
  }

  return commands
}

const createRandom = seed => {
  const twister = new MersenneTwister(seed)
  const random = (lo, hi) => twister.random() * (hi - lo) + lo
  return random
}

const intepret = commands => {
  let random = createRandom(Date.now()) // usage: eval(`random(0, -1)`)
  const config = {}
  const flows = []
  const nodes = []
  const inputs = []
  const outputs = []
  const vectors = {}
  for (const i in commands) {
    const [command, ...params] = commands[i]
    switch (command) {
      case 'WORLD': {
        const [width, height, learningRate, learningLeakage] = params
        config.width = parseFloat(width, 10)
        config.height = parseFloat(height, 10)
        config.learningRate = learningRate
        config.learningLeakage = learningLeakage
        break
      }
      case 'SEED': {
        let [seed] = params
        seed = parseInt(seed, 10)
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
        break
      }
      case 'FLOW': {
        let [a, b, w] = params
        const i = flows.length
        w = eval(w)
        flows.push({i, a, b, w, v: 0})
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
            flows.push({i, a, b, w, v: 0})
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
              flows.push({i, a, b, w, v: 0})
            }
            if (y < y2) {
              const w = eval(weight)
              const i = flows.length
              const a = `${x},${y}`
              const b = `${x},${y + 1}`
              flows.push({i, a, b, w, v: 0})
            }
          }
        }
        break
      }
      default: {
        break
      }
    }
  }

  const nodeMap = {}
  nodes.forEach(n => {
    nodeMap[n.label] = n
  })
  flows.forEach(f => {
    f.a = nodeMap[f.a].i
    f.b = nodeMap[f.b].i
    nodes[f.a].flows.push(f.i)
    nodes[f.b].flows.push(f.i)
  })

  return {config, flows, nodes, inputs, outputs}
}

const generate = program => {
  const commands = tokenise(program)
  const world = intepret(commands)
  return world
}

export default generate
