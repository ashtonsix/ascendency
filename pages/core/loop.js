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
    a = a.concat([1, -1])
    b = b.concat([1, -1])
    const aMag = Math.sqrt(dot(a, a))
    const bMag = Math.sqrt(dot(b, b))
    const similarity = dot(a, b) / (aMag * bMag) || 0
    return similarity + 2
  }
}

// adds non-linearity, and centers mean without changing anything with value of "0"
const normalise = world => {
  // const total = {
  //   weight: 0,
  //   loValue: 0,
  //   hiValue: 0
  // }

  // world.flows.forEach(f => {
  //   total.weight += Math.abs(f.w)
  //   if (f.v < 0) total.loValue += -f.v
  //   else total.hiValue += f.v
  // })

  // const shift = {
  //   weight: 1 / (total.weight / world.flows.length),
  //   loValue: total.hiValue >= total.loValue ? 1 : total.hiValue / total.loValue,
  //   hiValue: total.hiValue <= total.loValue ? 1 : total.loValue / total.hiValue
  // }

  world.flows.forEach(f => {
    // f.w *= shift.weight
    // f.v *= f.v < 0 ? shift.loValue : shift.hiValue

    if (f.w < 0) {
      const a = f.a
      f.a = f.b
      f.b = a
      f.w *= -1
    }
  })

  // if (total.loValue || total.hiValue) {
  //   const max = world.flows.reduce((pv, f) => Math.max(pv, Math.abs(f.v)), 0)
  //   world.flows.forEach(f => (f.v /= max))
  // }

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
    if (!sum) {
      return -(d + l) / you.length
    } else {
      if (v < 0) return -l
      return d * (v / sum) + l
    }
  })
}

const debug = (f, ff, d) => {
  const message = `from ${f.a} => ${f.b} to ${ff.a} => ${ff.b}, transfer ${d}`
  // console.log(message)
}

const loop = world => {
  const {config, flows, nodes, inputs, outputs, history} = world
  const {learningRate, learningLeak} = config

  let valueDelta = new Array(flows.length).fill(0)
  let valueOutput = new Array(outputs.length).fill(0)
  let weightDelta = new Array(flows.length).fill(0)
  let weightTakerSums = new Array(flows.length).fill(0)
  let weightInput = new Array(outputs.length).fill(0)
  let weightOutput = 0
  let totalValue = 0

  flows.forEach(f => (totalValue += Math.abs(f.v)))
  // give 25% weight backward, and get 25% weight taken from both directions,
  // this array does accounting to make the "take" aspect easier to calculate
  flows.forEach(f => {
    const forward = filterFlow(f, nodes[f.b].flows.map(i => flows[i]))
    const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))
    ;[].concat(forward, backward).forEach(ff => {
      const v = totalValue > 0 ? Math.abs(ff.v) : 1
      weightTakerSums[f.i] += learningRate * ff.w * v
    })
  })
  // console.log('---')
  flows.forEach(f => {
    const forward = filterFlow(f, nodes[f.b].flows.map(i => flows[i]))
    const backward = filterFlow(f, nodes[f.a].flows.map(i => flows[i]))
    const mForward = mapFlow(f, forward)
    const mBackward = mapFlow(f, backward)

    const labels = ['A', 'B', 'C', 'D']

    const input = inputs.indexOf(f.a)
    const output = outputs.indexOf(f.b)
    // if (output !== -1) {
    //   valueOutput[output] += f.v
    //   weightOutput += f.w * lr
    // } else {
    const lr = learningRate * (totalValue > 0 ? Math.abs(f.v) : 1)
    {
      const config = {learningRate: 1, learningLeak: 0}
      const vDelta = getDelta(f.v, mForward, config)
      forward.forEach((ff, i) => {
        const tw = f.w * lr
        const itw = weightTakerSums[ff.i] - tw
        const config = {learningRate: lr, learningLeak}
        const twDelta = getDelta(ff.w, [tw, itw], config)[0]
        // console.log(`${labels[f.i]} takes ${labels[ff.i]} ${twDelta}`)
        weightDelta[ff.i] -= ff.w > 0 ? twDelta : -twDelta
        weightDelta[f.i] += twDelta
        valueDelta[ff.i] += vDelta[i]
      })
      valueDelta[f.i] -= f.v
    }
    {
      const config = {learningRate: lr, learningLeak}
      const gwDelta = getDelta(f.w, mBackward, config)
      backward.forEach((ff, i) => {
        // console.log(`${labels[f.i]} gives ${labels[ff.i]} ${gwDelta[i]}`)
        weightDelta[ff.i] += gwDelta[i]
        weightDelta[f.i] -= Math.abs(gwDelta[i])
      })
    }
    // }
  })

  // let weightInput = new Array(inputs.length).fill(weightOutput / inputs.length)
  // let valueInput = new Array(inputs.length).fill(0)

  // inputs.forEach((j, i) => {
  //   const f = {i: -1, a: -1, b: j, w: weightInput[i], v: valueInput[i]}
  //   const forward = nodes[j].flows.map(i => flows[i])
  //   const mForward = mapFlow(f, forward)
  //   let config
  //   config = {learningRate: 1, learningLeak: 0}
  //   const vDelta = getDelta(f.v, mForward, config)
  //   config = {learningRate: 1, learningLeak}
  //   const wDelta = getDelta(f.w, mForward, config)
  //   forward.forEach((ff, i) => {
  //     valueDelta[ff.i] += vDelta[i]
  //     weightDelta[ff.i] += wDelta[i]
  //   })
  // })

  // TODO: boost inputs, use datasets/history/amplify

  flows.forEach(f => {
    f.v += valueDelta[f.i]
    f.v = activation[config.activation](f.v)
    f.w += weightDelta[f.i]
  })

  return normalise({config, flows, nodes, inputs, outputs, history}, true)
}

export {normalise}
export default loop
