// node = {i, x, y, flows: []}
// flow = {i, a, b, w, v}

const dot = (a, b) => {
  let sum = 0
  for (const i in a) sum += a[i] * b[i]
  return sum
}

const activation = {
  sigmoid: v => {
    return 2 / (1 + Math.exp(-v)) - 1
  }
}

const cost = {
  cosine: (a, b) => {
    return dot(a, b) / (Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b))) || 0
  }
}

// adds non-linearity, and centers mean without changing anything with value of "0"
const normalise = (world, debug) => {
  const total = {
    weight: 0,
    loValue: 0,
    hiValue: 0
  }

  world.flows.forEach(f => {
    total.weight += Math.abs(f.w)
    if (f.v < 0) total.loValue += -f.v
    else total.hiValue += f.v
  })

  const shift = {
    weight: 1 / (total.weight / world.flows.length),
    loValue: total.hiValue >= total.loValue ? 1 : total.hiValue / total.loValue,
    hiValue: total.hiValue <= total.loValue ? 1 : total.loValue / total.hiValue
  }
  // if (debug) console.log(total)
  // if (debug) console.log(shift)

  world.flows.forEach(f => {
    f.w *= shift.weight
    f.v *= f.v < 0 ? shift.loValue : shift.hiValue

    if (f.w < 0) {
      const a = f.a
      f.a = f.b
      f.b = a
      f.w *= -1
    }
  })

  if (total.loValue || total.hiValue) {
    const max = world.flows.reduce((pv, f) => Math.max(pv, Math.abs(f.v)), 0)
    world.flows.forEach(f => (f.v /= max))
  }

  return world
}

const filterForward = (start, end) => {
  const f = start
  return end.filter(ff => ff.i !== f.i)
}

const mapForward = (start, end) => {
  const f = start
  return end.map(ff => {
    let w = ff.w
    let backward = ff.b === f.b
    if (backward) w *= -1
    return w
  })
}

const getDelta = (start, end, {learningRate, learningLeak}) => {
  let sum = end.reduce((pv, v) => pv + Math.max(v, 0), 0)
  let d = start * learningRate
  let l = d * learningLeak
  d -= l
  l /= end.length
  return end.map(v => {
    if (!sum) {
      return -(d + l) / end.length
    } else {
      if (v < 0) return -l
      return d * (v / sum) + l
    }
  })
}

const debug = (f, ff, d) => {
  const message = `from ${f.a} => ${f.b} to ${ff.a} => ${ff.b}, transfer ${d}`
  console.log(message)
}

const loop = world => {
  const {config, flows, nodes, inputs, outputs, history} = world
  const {learningRate, learningLeak} = config

  let valueDelta = new Array(flows.length).fill(0)
  let valueOutput = new Array(outputs.length).fill(0)
  let weightDelta = new Array(flows.length).fill(0)
  let weightOutput = 0
  let totalValue = 0
  flows.forEach(f => (totalValue += Math.abs(f.v)))
  flows.forEach(f => {
    const forward = filterForward(f, nodes[f.b].flows.map(i => flows[i]))
    const mforward = mapForward(f, forward)
    const output = outputs.indexOf(f.b)
    const lr = learningRate * (totalValue > 0 ? Math.abs(f.v) : 1)
    if (output !== -1) {
      valueOutput[output] += f.v
      weightOutput += f.w * lr
    } else {
      let config
      config = {learningRate: 1, learningLeak: 0}
      const vDelta = getDelta(f.v, mforward, config)
      config = {learningRate: lr, learningLeak}
      const wDelta = getDelta(f.w, mforward, config)
      forward.forEach((ff, i) => {
        valueDelta[ff.i] += vDelta[i]
        weightDelta[ff.i] += wDelta[i]
      })
    }
    valueDelta[f.i] -= f.v
    weightDelta[f.i] -= f.w * lr
  })

  console.log(valueOutput[0], valueOutput[1])
  let valueInput = new Array(inputs.length).fill(0)
  valueInput[0] = 1
  valueInput[1] = -1

  let weightInput = new Array(inputs.length).fill(
    weightOutput / inputs.length + 1
  )
  weightInput[0] *= valueOutput[0] + 1
  weightInput[1] *= -valueOutput[1] + 1

  inputs.forEach((j, i) => {
    const f = {i: -1, a: -1, b: j, w: weightInput[i], v: valueInput[i]}
    const forward = nodes[j].flows.map(i => flows[i])
    const mforward = mapForward(f, forward)
    let config
    config = {learningRate: 1, learningLeak: 0}
    const vDelta = getDelta(f.v, mforward, config)
    config = {learningRate: 1, learningLeak}
    const wDelta = getDelta(f.w, mforward, config)
    forward.forEach((ff, i) => {
      valueDelta[ff.i] += vDelta[i]
      weightDelta[ff.i] += wDelta[i]
    })
  })

  // TODO: boost inputs, use datasets/history/cost/activation

  flows.forEach(f => {
    f.v += valueDelta[f.i]
    f.v = activation[config.activation](f.v)
    f.w += weightDelta[f.i]
  })

  return normalise({config, flows, nodes, inputs, outputs, history}, true)
}

export {normalise}
export default loop
