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

const amplify = {
  cosine: (a, b) => {
    a = a.concat([1, -1]) // measure magnitude in addition to angle
    b = b.concat([1, -1])
    const aMag = Math.sqrt(dot(a, a))
    const bMag = Math.sqrt(dot(b, b))
    const similarity = dot(a, b) / (aMag * bMag) || 0
    return similarity / 2 + 1.5 // change domain from [-1, 1] to [1, 2]
  }
}

const normalise = world => {
  world.flows.forEach(f => {
    if (f.w < 0) {
      const a = f.a
      f.a = f.b
      f.b = a
      f.w *= -1
    }
  })

  return world
}

const filterFlow = (me, you) => {
  const f = me
  return you.filter(ff => ff.i !== f.i)
}

const mapFlow = (me, you) => {
  const f = me
  return you.map(ff => {
    let w = ff.w
    let backward = ff.b === f.b || ff.a === f.a
    if (backward) w *= -1
    return w
  })
}

const getDelta = (me, you, {learningRate, learningLeak}) => {
  let sum = you.reduce((pv, v) => pv + Math.max(v, 0), 0)
  let d = me * learningRate
  let l = d * learningLeak
  d -= l
  l /= you.length
  return you.map(v => {
    if (!sum && learningLeak) {
      return -(d + l) / you.length
    } else {
      if (v < 0) return -l
      return d * (v / sum) + l
    }
  })
}

const loop = world => {
  const {config, flows, nodes, inputs, outputs, history} = world
  const {learningRate, learningLeak} = config

  let valueInput = [1]
  let valueDelta = new Array(flows.length).fill(0)
  let valueOutput = new Array(outputs.length).fill(0)
  let weightDelta = new Array(flows.length).fill(0)
  let weightTakerSums = new Array(flows.length).fill(0)
  let weightTakerCounts = new Array(flows.length).fill(0)
  let weightInputTransfer = 0
  let weightInputTaken = 0
  let totalValue = 0

  valueInput.forEach(v => (totalValue += Math.abs(v)))
  flows.forEach(f => (totalValue += Math.abs(f.v)))
  flows.forEach(f => {
    const forward = filterFlow(f, nodes[f.b].flows.map(i => flows[i]))
    const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))
    const input = inputs.includes(f.a)
    const output = outputs.includes(f.b)
    if (input || output) {
      const v = totalValue > 0 ? Math.abs(f.v) : 1
      const d = learningRate * f.w * v
      weightInputTransfer += d * 2
      if (output) weightInputTaken += d
      if (input) weightDelta[f.i] -= d * 2
    }
    if (input) {
      const input = inputs.indexOf(f.a)
      valueDelta[f.i] += valueInput[input]
    }
    if (output) {
      const output = outputs.indexOf(f.b)
      valueOutput[output] += f.v
      valueDelta[f.i] -= f.v
    }
    ;[].concat(forward, backward).forEach(ff => {
      const outputAdjacent = outputs.includes(ff.b)
      if (!outputAdjacent) {
        const v = totalValue > 0 ? Math.abs(ff.v) : 1
        weightTakerSums[f.i] += learningRate * ff.w * v
        weightTakerSums[f.i] += 1
      }
    })
  })
  if (weightInputTaken) weightInputTransfer *= 1 + valueOutput[0]
  flows.forEach(f => {
    const forward = filterFlow(f, nodes[f.b].flows.map(i => flows[i]))
    const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))
    const mForward = mapFlow(f, forward)
    const mBackward = mapFlow(f, backward)

    const input = inputs.includes(f.a)
    const output = outputs.includes(f.b)
    const tlr = learningRate * (totalValue > 0 ? Math.abs(f.v) : 1)
    if (output) {
      const d = (f.w * tlr * weightInputTransfer) / weightInputTaken
      weightDelta[f.i] += d || 0
    }
    if (input && weightInputTaken === 0) {
      const d = weightInputTransfer / inputs.length
      weightDelta[f.i] += d
    }
    if (!output) {
      const config = {learningRate: 1, learningLeak: 0}
      const vDelta = getDelta(f.v, mForward, config)
      forward.forEach((ff, i) => {
        const tw = f.w * tlr
        const tws = weightTakerSums[ff.i]

        // weird hack for learningLeak calculation
        const twc = weightTakerCounts[ff.i]
        const ll = twc === 1 ? learningLeak / 2 : learningLeak
        const config = {learningRate: tlr, learningLeak: ll}
        const faked = [tw, tws - tw]
        if (twc >= 2) faked.length = weightTakerCounts[ff.i]

        let twDelta = getDelta(ff.w, faked, config)[0]

        // flip unused backward-facing flows
        if (tws && ff.v === 0 && mForward[i] < 0) {
          const epsilon = 1e-5
          const d = Math.min(f.w * learningRate, ff.w * (tw / tws))
          if (d > twDelta) twDelta = d + epsilon
        }

        weightDelta[ff.i] -= twDelta
        weightDelta[f.i] += twDelta
        valueDelta[ff.i] += vDelta[i]
      })
      valueDelta[f.i] -= f.v
    }
    if (!input) {
      const config = {learningRate, learningLeak}
      const mvBackward = backward.map((ff, i) => Math.abs(ff.v) * mBackward[i])
      const gwDelta = getDelta(f.w, mvBackward, config, output)
      backward.forEach((ff, i) => {
        weightDelta[ff.i] += gwDelta[i]
        weightDelta[f.i] -= Math.abs(gwDelta[i])
      })
    }
  })

  // TODO: datasets/history/amplify/window/normalise/modifiers/bias

  flows.forEach(f => {
    f.v += valueDelta[f.i]
    f.v = activation[config.activation](f.v)
    f.w += weightDelta[f.i]
  })

  return normalise({config, flows, nodes, inputs, outputs, history})
}

export {normalise}
export default loop
