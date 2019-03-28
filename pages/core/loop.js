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
    // s(s(...s(x))) = -1 || 0 || 1
    const norm = 1.543404638418
    v *= norm
    v = 2 / (1 + Math.exp(-v)) - 1
    v *= norm
    return v
  }
}

const errorToAmplify = (error, domain) => {
  const [lo, hi] = domain
  error += 1 / (hi - lo)
  const amplify = 1 / error + lo
  return amplify
}

const amplify = {
  mse: (a, b, amplitude) => {
    let total = 0
    a.forEach((_, i) => (total += Math.abs(a[i] - b[i]) ** 2))
    const error = total / a.length
    return errorToAmplify(error, [1, 1 + amplitude])
  }
}

const getPartialDerivatives = (output, target, amplify) => {
  const slopes = output.map((_, i) => {
    const outputLo = [...output]
    const outputHi = [...output]
    outputLo[i] = outputLo[i] - epsilon
    outputHi[i] = outputHi[i] + epsilon
    const x = epsilon
    const y = amplify(outputHi, target) - amplify(outputLo, target)
    return y / x
  })
  return slopes
}

const filterFlow = (me, you) => {
  const f = me
  const filtered = []
  you.forEach(ff => {
    if (ff.i === f.i) return
    let reversed = ff.b === f.b || ff.a === f.a
    if (reversed) return
    filtered.push(ff)
  })
  return filtered
}

const weightedAverage = (me, you) => {
  if (you.length === 1) return [me]
  let sum = you.reduce((pv, v) => pv + v, 0)
  if (!sum) return you.map(() => 0)
  return you.map(you => me * (you / sum))
}

const linearRescale = arr => {
  if (arr.length === 0) return []
  if (arr.length === 1) return [1]
  const min = Math.min(...arr)
  const max = Math.max(...arr)

  if (min === max) return new Array(arr.length).fill(1 / arr.length)

  return arr.map(v => (v - min) / (max - min))
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

const normalise = world => {
  const {flows} = world

  const total = flows.reduce((pv, f) => pv + f.w, 0)
  const average = total / flows.length
  flows.forEach(f => (f.w /= average))

  return world
}

const loop = world => {
  const {
    config,
    flows,
    nodes,
    inputs,
    outputs,
    plusBias,
    minusBias,
    data,
    time
  } = world
  const {
    predictionDelay,
    amplitude,
    transferRate,
    cycleAspect,
    cycleLeak,
    valueDecay,
    slopeDecay
  } = config
  let valueInput, valueTarget
  const value = {valueInput, valueTarget}
  world.value = value

  let valueDelta = new Array(flows.length).fill(0)
  let slopeDelta = new Array(flows.length).fill(0)
  let weightDelta = new Array(flows.length).fill(0)

  // STEP 1. load data; 2/1 cycle; input / output
  {
    const t1 = Math.floor(time / predictionDelay)
    const t3 = Math.floor(t1 / 3)
    const defaultValue = [inputs.map(() => 0), outputs.map(() => 0)]
    ;[valueInput, valueTarget] = data[t3 % data.length] || defaultValue
    value.valueInput = valueInput
    value.valueTarget = valueTarget
    const relax = false // t1 % 3 === 2

    let IOSent = 0
    ;[...inputs, ...plusBias, ...minusBias].forEach(i => {
      const n = nodes[i]
      const f = flows[n.flows[0]]
      let d = f.w * transferRate
      if (!f.s) d *= cycleAspect
      IOSent += d
      weightDelta[f.i] -= d
    })

    const valueOutput = new Array(outputs.length).fill(0)
    outputs.forEach((i, j) => {
      const n = nodes[i]
      const f = flows[n.flows[0]]
      valueOutput[j] += f.v
      valueDelta[f.i] -= f.v
    })
    if (!relax) {
      IOSent *= amplify[config.amplify](valueOutput, valueTarget, amplitude)
    }
    value.valueOutput = valueOutput

    const slopeOutput = getPartialDerivatives(
      valueOutput,
      valueTarget,
      (vo, vt) => amplify[config.amplify](vo, vt, amplitude)
    )
    const vSlopeOutput = slopeOutput.map((s, j) => {
      const i = outputs[j]
      const n = nodes[i]
      const f = flows[n.flows[0]]
      const signAgrees = f.v / f.v === s / s
      return Math.abs(s) * (signAgrees ? 1 : -1)
    })
    const vSlopeMin = Math.min(...vSlopeOutput)
    const wDelta = weightedAverage(IOSent, vSlopeOutput.map(v => v + vSlopeMin))

    outputs.forEach((i, j) => {
      const n = nodes[i]
      const f = flows[n.flows[0]]
      slopeDelta[f.i] += slopeOutput[j]
      weightDelta[f.i] += wDelta[j]
    })

    if (!relax) {
      inputs.forEach((i, j) => {
        const n = nodes[i]
        const f = flows[n.flows[0]]
        valueDelta[f.i] += valueInput[j]
        slopeDelta[f.i] -= f.s
      })
      plusBias.forEach(i => {
        const n = nodes[i]
        n.flows.forEach(j => {
          const f = flows[j]
          valueDelta[f.i] += f.w
          slopeDelta[f.i] -= f.s
        })
      })
      minusBias.forEach(i => {
        const n = nodes[i]
        n.flows.forEach(j => {
          const f = flows[j]
          valueDelta[f.i] -= f.w
          slopeDelta[f.i] -= f.s
        })
      })
    }

    if (relax) {
      flows.forEach(f => (f.s = 0))
      value.valueTarget = outputs.map(() => 0)
    }
  }

  // STEP 2. value
  {
    flows.forEach(f => {
      if (outputs.includes(f.b)) return

      const forward = filterFlow(f, nodes[f.b].flows.map(i => flows[i]))

      const vDelta = weightedAverage(f.v, forward.map(ff => ff.w))
      forward.forEach((ff, i) => {
        if (!inputs.includes(ff.a)) valueDelta[ff.i] += vDelta[i]
      })
      valueDelta[f.i] -= f.v
    })
  }

  // STEP 3. slope
  {
    flows.forEach(f => {
      const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))

      const sDelta = weightedAverage(f.s, backward.map(ff => ff.w))
      backward.forEach((ff, i) => {
        if (!outputs.includes(ff.b)) slopeDelta[ff.i] += sDelta[i]
      })
      slopeDelta[f.i] -= f.s
    })
    // apply immediately. needed for weight flow calculation
    flows.forEach(f => {
      if (f.v) {
        f.s += slopeDelta[f.i]
        f.s *= 1 - slopeDecay
      } else {
        // REVISIT, possible in edge case. what we really want,
        // is not to activate until value reaches output
        f.s = 0
      }
    })
  }

  // STEP 4. slope weight
  {
    flows.forEach(f => {
      if (inputs.includes(f.a) || !f.s) return

      const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))
      const d = f.w * transferRate * (1 - cycleAspect)

      let vBackward = linearRescale(backward.map(ff => ff.v))
      if (f.s < 0) vBackward = vBackward.map(v => -v + 1)

      const wDelta = weightedAverage(d, vBackward)
      backward.forEach((ff, i) => {
        weightDelta[ff.i] += wDelta[i]
        weightDelta[f.i] -= wDelta[i]
      })
    })
  }

  // STEP 5. cycle weight
  {
    flows.forEach(f => {
      if (inputs.includes(f.a)) return

      const backward = nodes[f.a].flows
        .map(i => flows[i])
        .filter(ff => ff.i !== f.i)

      const wBackward = backward.map(ff => {
        let w = ff.w
        let reversed = ff.b === f.b || ff.a === f.a
        if (reversed) w *= -1
        return w
      })
      let d = f.w * transferRate * cycleAspect

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
        if (outputs.includes(ff.b)) return
        weightDelta[ff.i] += wDelta[i]
        weightDelta[f.i] -= Math.abs(wDelta[i])
      })
    })
  }

  // STEP 6. apply value/weight
  {
    flows.forEach(f => {
      f.w += weightDelta[f.i]
      f.v += valueDelta[f.i]
      f.v *= 1 - valueDecay
      f.v = activate[config.activate](f.v)
    })
  }

  // TODO: split-diamonds/bias/batch
  // no slope in 1 & 3, no value input in 3
  // phases: PREDICT, LEARN, RESET

  normalise(world)
  sanitise(world)
  world.time += 1

  return world
}

export {sanitise}
export default loop
