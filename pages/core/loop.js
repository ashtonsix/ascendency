// node = {i, x, y, a: [], b: []}
// exchange = {i, a, b, f}
// "f" is flow from a to b

// node = {i, x, y, flows: []}
// flow = {i, a, b, w, v}

const normaliseFlows = flows => {
  let sum = 0
  flows.forEach(f => (sum += Math.abs(f.w)))

  let product = 1 / (sum / flows.length)
  flows.forEach(f => {
    f.w *= product

    if (f.w < 0) {
      const a = f.a
      f.a = f.b
      f.b = a
      f.w *= -1
    }
  })
}

const loop = world => {
  const {config, flows, nodes, inputs, outputs} = world
  const {learningRate, learningLeakage} = config

  normaliseFlows(flows)

  // calculate deltas
  const delta = new Array(flows.length).fill(0)
  flows.forEach((f, i) => {
    let d = Math.abs(f.w * learningRate)
    let sum = 0
    const forward = []
    delta[f.i] -= d
    nodes[f.b].flows.forEach(j => {
      const ff = flows[j]
      if (ff.i === f.i) return
      const backward = ff.b === f.a || ff.b === f.b
      if (!backward) sum += ff.w
      forward.push(ff)
    })

    const leak = (d * learningLeakage) / forward.length
    const allBackward = sum === 0
    forward.forEach(ff => {
      let df = 0
      const l = leak
      if (allBackward) {
        df = -((d + l) / forward.length)
      } else {
        const backward = ff.b === f.a || ff.b === f.b
        if (backward) df = -l
        else df = l + d * Math.abs(ff.w / sum)
      }
      delta[ff.i] += df
    })
  })

  Object.keys(delta).forEach(i => {
    const f = flows[i]
    f.w += delta[i]
  })

  normaliseFlows(flows) // only necessary for display

  return {config, flows, nodes, inputs, outputs}
}

export default loop
