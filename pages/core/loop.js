// node = {i, x, y, flows: []}
// flow = {i, a, b, w, v}

const dot = (a, b) => {
  let sum = 0
  for (const i in a) sum += a[i] * b[i]
  return sum
}

const activation = {
  sigmoid: v => {
    return 3 / (1 + Math.exp(-v)) - 1.5
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

const filterFlow = (me, you) => {
  const f = me
  return you.filter(ff => ff.i !== f.i)
}

const mapWeightDirection = (me, you) => {
  const f = me
  return you.map(ff => {
    let w = ff.w
    let backward = ff.b === f.b || ff.a === f.a
    if (backward) w *= -1
    return w
  })
}

// weighted average, with extras
const getDelta = (me, you, {learningRate, learningLeak, weightMode}) => {
  let sum = you.reduce((pv, v) => pv + Math.max(v, 0), 0)
  let d = me * learningRate
  let l = d * learningLeak
  d -= l
  l /= you.length
  return you.map(v => {
    if (!sum) {
      if (weightMode) {
        return -(d + l) / you.length
      } else {
        return 0
      }
    } else {
      if (v < 0) return -l
      return d * (v / sum) + l
    }
  })
}

const weightMode = world => {
  const {config, flows, nodes} = world
  const {learningRate, learningLeak} = config

  let valueDelta = new Array(flows.length).fill(0)
  let weightDelta = new Array(flows.length).fill(0)

  flows.forEach(f => {
    const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))
    const wBackward = mapWeightDirection(f, backward)

    const config = {learningRate, learningLeak, weightMode: true}
    const wDelta = getDelta(f.w, wBackward, config)
    backward.forEach((ff, i) => {
      weightDelta[ff.i] += wDelta[i]
      weightDelta[f.i] -= Math.abs(wDelta[i])
    })
  })

  return {weightDelta, valueDelta}
}

const valueMode = world => {
  const {config, flows, nodes, inputs, outputs, history} = world
  const {learningRate, learningLeak} = config

  let valueInput = [1]
  let valueTarget = [1, 0]
  let valueOutput = new Array(outputs.length).fill(0)
  let valueDelta = new Array(flows.length).fill(0)

  let weightDelta = new Array(flows.length).fill(0)
  let IOSent = 0
  let IORequested = 0

  flows.forEach(f => {
    const input = inputs.includes(f.a)
    const output = outputs.includes(f.b)
    if (input) {
      const input = inputs.indexOf(f.a)
      valueDelta[f.i] += valueInput[input]

      const d = learningRate * f.w
      IOSent += d
      weightDelta[f.i] -= d
    }
    if (output) {
      const output = outputs.indexOf(f.b)
      valueOutput[output] += f.v
      valueDelta[f.i] -= f.v

      IORequested += Math.abs(f.v)
    }
  })

  if (IORequested) {
    const amplify = (output, target) => {
      console.log(...output)
      return 1 + (output[0] + output[1]) * 100
    }
    IOSent *= amplify(valueOutput, valueTarget)
  }

  flows.forEach(f => {
    const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))
    const wBackward = mapWeightDirection(f, backward)
    const forward = filterFlow(f, nodes[f.b].flows.map(i => flows[i]))
    const wForward = mapWeightDirection(f, forward)

    const input = inputs.includes(f.a)
    const output = outputs.includes(f.b)
    if (output && f.v) {
      const d = (Math.abs(f.v) * IOSent) / IORequested
      weightDelta[f.i] += d || 0
    }
    if (!output && f.v) {
      const config = {learningRate: 1, learningLeak: 0}
      const vDelta = getDelta(f.v, wForward, config)
      forward.forEach((ff, i) => {
        vDelta[i] = Math[f.v < 0 ? 'min' : 'max'](vDelta[i], 0)
        valueDelta[ff.i] += vDelta[i]
      })
      valueDelta[f.i] -= f.v
    }
    let active = !!f.v
    if (!input) {
      const config = {learningRate, learningLeak}
      const vBackward = backward.map((ff, i) => {
        let v = Math.abs(ff.v)
        if (wBackward[i] < 0) v *= -1
        return v
      })
      const wDelta = getDelta(f.w, vBackward, config)
      backward.forEach((ff, i) => {
        if (wDelta[i]) active = true
        weightDelta[ff.i] += wDelta[i]
        weightDelta[f.i] -= Math.abs(wDelta[i])
      })
    }
    // special case for unused backward-facing flow
    if (!input && !active && forward.some((f, i) => f.v && wForward[i] < 0)) {
      const epsilon = 1e-7
      const config = {learningRate, learningLeak: 0}
      let w = wForward.reduce((max, w) => Math.max(max, -w), f.w)
      if (w * learningRate > f.w) w = f.w / learningRate + epsilon
      const vForward = forward.map((ff, i) => {
        let v = Math.abs(ff.v)
        if (wForward[i] > 0) v *= -1
        return v
      })
      const wDelta = getDelta(w, vForward, config)
      forward.forEach((ff, i) => {
        weightDelta[ff.i] += Math.abs(wDelta[i])
        weightDelta[f.i] -= Math.abs(wDelta[i])
      })
    }
  })

  return {weightDelta, valueDelta}
}

const mode = {weight: weightMode, value: valueMode}

const sanitise = world => {
  const {flows} = world

  flows.forEach(f => {
    if (f.w < 0) {
      const a = f.a
      f.a = f.b
      f.b = a
      f.w *= -1
    }
  })

  return world
}

const loop = world => {
  const {config, flows} = world
  const getDelta = mode[config.mode]
  const {weightDelta, valueDelta} = getDelta(world)

  // TODO: datasets/history/amplify/window/sanitise/modifiers/bias

  flows.forEach(f => {
    f.v += valueDelta[f.i]
    f.v = activation[config.activation](f.v)
    f.w += weightDelta[f.i]
  })
  sanitise(world)

  return world
}

export {sanitise}
export default loop
