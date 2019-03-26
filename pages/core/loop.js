// node = {i, x, y, flows: []}
// flow = {i, a, b, w, v, s}

const epsilon = 1e-7

const activate = {
  sigmoid: v => {
    // sigmoid(-1  ) = -1
    // sigmoid( 0  ) =  0
    // sigmoid( 0.5) =  0.57
    // sigmoid( 1  ) =  1
    // sigmoid( 2  ) =  1.41
    const norm = 1.543404638418
    v *= norm
    v = 2 / (1 + Math.exp(-v)) - 1
    v *= norm
    return v
  }
}

const dot = (a, b) => {
  let sum = 0
  for (const i in a) sum += a[i] * b[i]
  return sum
}

const errorToAmplify = (error, domain) => {
  const [lo, hi] = domain
  error += 1 / (hi - lo)
  const amplify = 1 / error + lo
  return amplify
}

const amplify = {
  cosine: (a, b) => {
    const aMag = Math.sqrt(dot(a, a))
    const bMag = Math.sqrt(dot(b, b))
    const similarity = dot(a, b) / (aMag * bMag) || 0
    const error = similarity + 1
    return errorToAmplify(error, [1, 10])
  },
  mse: (a, b) => {
    let total = 0
    a.forEach((_, i) => (total += Math.abs(a[i] - b[i]) ** 2))
    const error = total / a.length
    return errorToAmplify(error, [1, 10])
  }
}

const getPartialDerivatives = (output, target, amplify) => {
  const compare = amplify(output, target)
  const slopes = output.map((_, i) => {
    const outputX = [...ouput]
    outputX[i] = outputX[i] + epsilon
    const x = epsilon
    const y = amplify(outputX, target) - compare
    return y / x
  })
  return slopes
}

const filterFlow = (me, you, includeReversed) => {
  const f = me
  const filtered = []
  you.forEach(ff => {
    if (ff.i === f.i) return
    let reversed = ff.b === f.b || ff.a === f.a
    if (!includeReversed && reversed) return
    filtered.push(ff)
  })
  return filtered
}

const weightedAverage = (me, you) => {
  let sum = you.reduce((pv, v) => pv + v, 0)
  if (!sum) return you.map(() => 0)
  return you.map(you => me * (you / sum))
}

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
  let {config, flows, data, time} = world

  const {config, flows, nodes, inputs, outputs, data, time} = world
  const {
    predictionDelay,
    learningRate,
    cycleAspect,
    cycleLeak,
    valueDecay,
    slopeDecay
  } = config
  const value = {}
  world.value = value

  let valueDelta = new Array(flows.length).fill(0)
  let slopeDelta = new Array(flows.length).fill(0)
  let weightDelta = new Array(flows.length).fill(0)

  // STEP 1. load data
  {
    const t1 = Math.floor(time / predictionDelay)
    const t3 = Math.floor(t / 3)
    let [valueInput, valueTarget] = data[t3 % data.length]
    if (t1 % 3 === 2) {
      valueInput = valueInput.map(() => 0)
      valueTarget = valueTarget.map(() => 0)
    }
    value.valueInput = valueInput
    value.valueTarget = valueTarget
  }

  // STEP 2. input / output
  {
    let IOSent = 0
    inputs.forEach(i => {
      const n = nodes[i]
      const f = flows[n.flows[0]]
      let d = f.w * learningRate
      if (!f.s) d *= cycleAspect
      IOSent += d
      weightDelta[f.i] -= d
    })

    let valueOutput = new Array(outputs.length).fill(0)
    outputs.forEach((i, j) => {
      const n = nodes[i]
      const f = flows[n.flows[0]]
      valueOutput[j] += f.v
      valueDelta[f.i] -= f.v
    })
    IOSent *= amplify[config.amplify](valueOutput, valueTarget)
    value.valueOutput = valueOutput

    let slopeOutput = getPartialDerivatives(
      valueOutput,
      valueTarget,
      amplify[config.amplify]
    )
    const slopeMin = Math.min(...slopeOutput)
    const slopeSum = slopeOutput.reduce((pv, v) => pv + v + slopeMin, 0)

    outputs.forEach((i, j) => {
      const n = nodes[i]
      const f = flows[n.flows[0]]
      slopeDelta[f.i] += slopeOutput[j]
      const share = (slopeOutput[j] + slopeMin) / slopeSum
      const d = IOSent / share
      weightDelta[f.i] += d
    })

    inputs.forEach((i, j) => {
      const n = nodes[i]
      const f = flows[n.flows[0]]
      valueDelta[f.i] += valueInput[j]
      slopeDelta[f.i] -= f.s
    })
  }

  // STEP 3. value
  {
    flows.forEach(f => {
      const forward = filterFlow(f, nodes[f.b].flows.map(i => flows[i]))

      const vDelta = weightedAverage(f.v, forward.map(ff => ff.w))
      forward.forEach((ff, i) => {
        if (!inputs.includes(ff.a)) valueDelta[ff.i] += vDelta[i]
      })
      valueDelta[f.i] -= f.v
    })
  }

  // STEP 4. slope
  {
    flows.forEach(f => {
      const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))

      const sDelta = weightedAverage(f.s, backward.map(ff => ff.w))
      backward.forEach((ff, i) => {
        if (!outputs.includes(ff.b)) slopeDelta[ff.i] += sDelta[i]
      })
      slopeDelta[ff.i] -= f.s
    })
    // apply immediately. needed for weight flow calculation
    flows.forEach(f => {
      if (f.v) {
        f.s += slopeDelta[f.i]
        f.s *= 1 - slopeDecay
      } else {
        f.s = 0
      }
    })
  }

  // STEP 5. slope weight
  {
    flows.forEach(f => {
      const input = inputs.includes(f.a)

      if (input || !f.s) return

      const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))
      const sMin = Math.min(...backward.map(ff => ff.s))
      const sMax = Math.max(...backward.map(ff => ff.s))
      const d = f.w * learningRate * (1 - cycleAspect)

      let sBackward = backward.map(ff => (ff.s - sMin) / (sMax - sMin))
      if (f.s < 0) sBackward = sBackward.map(v => -v + 1)

      const wDelta = weightedAverage(d, sBackward)
      backward.forEach((ff, i) => {
        weightDelta[ff.i] += wDelta[i]
        weightDelta[f.i] -= wDelta[i]
      })
    })
  }

  // STEP 6. cycle weight
  {
    flows.forEach(f => {
      if (inputs.includes(f.a)) return

      const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]), true)

      const wBackward = backward.map(ff => {
        let w = ff.w
        let reversed = ff.b === f.b || ff.a === f.a
        if (reversed) w *= -1
        return w
      })
      const d = f.w * learningRate * cycleAspect

      let wDelta
      let sum = wBackward.reduce((pv, v) => pv + Math.max(v, 0), 0)
      if (sum) {
        let l = d * cycleLeak
        d -= l
        l /= wBackward.length
        wDelta = wBackward.map(v => {
          if (v < 0) return -l
          return d * (v / sum) + l
        })
      } else {
        wDelta = wBackward.map(() => -d / wBackward.length)
      }

      backward.forEach((ff, i) => {
        weightDelta[ff.i] += wDelta[i]
        weightDelta[f.i] -= Math.abs(wDelta[i])
      })
    })
  }

  // STEP 7. apply value/weight
  {
    flows.forEach(f => {
      f.w += weightDelta[f.i]
      f.v += valueDelta[f.i]
      f.v *= 1 - valueDecay
      f.v = activate[config.activate](f.v)
    })
  }

  // TODO: split-diamonds/bias/batch

  // normalise weights
  sanitise(world)
  world.time += 1

  return world
}

export {sanitise}
export default loop
