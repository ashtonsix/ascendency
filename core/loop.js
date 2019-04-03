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
  if (!sum) return you.map(() => me / you.length)
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
  const mean = total / flows.length
  flows.forEach(f => (f.w /= mean))

  return world
}

const cancelBias = world => {
  const {flows, nodes, plusBias, minusBias} = world

  nodes.forEach(n => {
    const p = n.flows.find(i => plusBias.includes(flows[i].a))
    const m = n.flows.find(i => minusBias.includes(flows[i].a))
    if (typeof p === 'number' && typeof m === 'number') {
      const d = Math.min(flows[p].w, flows[m].w) - epsilon
      flows[p].w -= d
      flows[m].w -= d
    }
  })

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
  let valueInput, valueTarget, valueOutput
  const value = {valueInput, valueTarget}
  world.value = value

  let valueDelta = new Array(flows.length).fill(0)
  let slopeDelta = new Array(flows.length).fill(0)
  let weightDelta = new Array(flows.length).fill(0)
  let phase
  let firstTickOfPhase
  let firstTickOfEpoch

  // STEP 1. load data; set phase; input / output
  {
    firstTickOfPhase = time % predictionDelay === 0
    firstTickOfEpoch = time % (predictionDelay * 4 * data.length) === 0

    const t1 = Math.floor(time / predictionDelay)
    phase = ['PREDICT', 'SLOPE', 'LEARN', 'RESET'][t1 % 4]
    const t4 = Math.floor(t1 / 4)
    const defaultValue = [inputs.map(() => 0), outputs.map(() => 0)]
    ;[valueInput, valueTarget] =
      phase === 'RESET' ? defaultValue : data[t4 % data.length] || defaultValue
    value.valueInput = valueInput
    value.valueTarget = valueTarget

    let IOSent = 0
    // prettier-ignore
    let circuitComplete = outputs.reduce((pv, i) => pv || !!flows[nodes[i].flows[0]].v, false)
    ;[...inputs, ...plusBias, ...minusBias].forEach(i => {
      const n = nodes[i]
      n.flows.forEach((_, i) => {
        const f = flows[n.flows[i]]
        let d = f.w * transferRate
        if (!circuitComplete) d *= cycleAspect
        IOSent += d
        weightDelta[f.i] -= d
      })
    })

    valueOutput = new Array(outputs.length).fill(0)
    outputs.forEach((i, j) => {
      const n = nodes[i]
      const f = flows[n.flows[0]]
      valueOutput[j] += f.v
      valueDelta[f.i] -= f.v
    })
    const score = amplify[config.amplify](valueOutput, valueTarget, amplitude)
    IOSent *= score
    value.valueOutput = valueOutput

    if (firstTickOfEpoch) console.log('---')
    if (firstTickOfPhase && phase === 'LEARN') {
      console.log(valueInput, valueOutput[0], valueTarget[0])
    }

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
    const wDelta = weightedAverage(IOSent, vSlopeOutput.map(v => v - vSlopeMin))

    outputs.forEach((i, j) => {
      const n = nodes[i]
      const f = flows[n.flows[0]]
      slopeDelta[f.i] += slopeOutput[j]
      weightDelta[f.i] += wDelta[j]
    })

    if (phase !== 'RESET') {
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
    if (phase === 'RESET') {
      flows.forEach(f => (f.s = 0))
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
    if (phase === 'SLOPE') {
      flows.forEach(f => {
        f.s += slopeDelta[f.i]
        f.s *= 1 - slopeDecay
      })
    }
  }

  // STEP 4. slope weight
  {
    flows.forEach(f => {
      if (inputs.includes(f.a)) return

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
      const la = nodes[f.a].label
      const lb = nodes[f.b].label
      if (phase === 'LEARN') {
        f.w += weightDelta[f.i]
      }
      if (phase === 'PREDICT' || phase === 'RESET') {
        f.v += valueDelta[f.i]
        f.v *= 1 - valueDecay
        f.v = activate[config.activate](f.v)
      }
    })
  }

  // TODO: split-diamonds/batch

  cancelBias(world)
  normalise(world)
  sanitise(world)
  world.time += 1

  return world
}

export {sanitise}
export default loop
