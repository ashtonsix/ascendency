import * as Quadtree from 'quadtree-lib'

let ctx

const setContext = updatedContext => (ctx = updatedContext)

const Attribute = (name, options) => {
  const defaultOptions = {direction: false, value: () => 0}
  ctx.attributes[name] = {...defaultOptions, ...options}
}

const Node = ({x, y}) => {
  const i = ctx.nodes.length
  const flows = []
  const node = {i, x, y, flows}
  ctx.nodes.push(node)
  return i
}

const Flow = (ax, bx, attrs = {}) => {
  if (!(ax instanceof Array)) ax = [ax]
  if (!(bx instanceof Array)) bx = [bx]

  const f = []
  for (const ai in ax) {
    for (const bi in bx) {
      const a = ax[ai]
      const b = bx[bi]

      const i = ctx.flows.length
      const flow = {i, a, b}
      for (const k in ctx.attributes) {
        let v = attrs[k]
        if (v === undefined) {
          v = ctx.attributes[k].value
          v = v ? v() : 0
        }
        flow[k] = v
      }
      f.push(flow.i)
      ctx.flows.push(flow)
    }
  }

  return f
}

const Boundary = (nodes, options) => {
  const defaultOptions = {directionFixed: false, color: 'red', shape: 'diamond'}
  const b = []
  nodes.forEach(n => {
    const i = ctx.boundaries.length
    const node = n.i || n
    const boundary = {i, node, ...defaultOptions, ...options}
    for (const k in ctx.attributes) boundary[k] = 0
    b.push(boundary.i)
    ctx.boundaries.push(boundary)
  })
  return b
}

const selectIndex = (options = {}) => {
  const {width, height} = options
  ctx.select = {
    pointer: 0,
    quadtree: new Quadtree({width, height})
  }
  const {pointer, quadtree} = ctx.select
  quadtree.pushAll(ctx.nodes.slice(pointer))
  ctx.select.pointer = ctx.nodes.length
}

const select = ({x, y, x0, x1, y0, y1}) => {
  ;[x0, x1] = typeof x === 'number' ? [x, x + 1e-7] : [x0, x1]
  ;[y0, y1] = typeof y === 'number' ? [y, y + 1e-7] : [y0, y1]

  if (!ctx.select) throw new Error('call "selectIndex()" first')

  const {pointer, quadtree} = ctx.select
  if (pointer !== ctx.nodes.length) {
    quadtree.pushAll(ctx.nodes.slice(pointer))
    ctx.select.pointer = ctx.nodes.length
  }

  const nodes = quadtree.colliding({
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0
  })

  return nodes.map(n => n.i)
}

const transaction = cb => {
  cb(ctx)
  delete ctx.select
  ctx.nodes.forEach(n => (n.flows = []))
  ctx.flows.forEach(f => {
    const na = ctx.nodes[f.a]
    const nb = ctx.nodes[f.b]
    if (!na.flows.includes(f.i)) na.flows.push(f.i)
    if (!nb.flows.includes(f.i)) nb.flows.push(f.i)
  })
}

const normalise = (attr, {mean: desiredMean}) => {
  const total = ctx.flows.reduce((pv, f) => pv + f[attr], 0)
  const mean = total / ctx.flows.length
  const mult = desiredMean / mean
  ctx.flows.forEach(f => (f[attr] *= mult))
}

const poly = (args, ...tests) => {
  for (const i in tests) {
    const [test, map] = tests[i]
    if (test instanceof Array) {
      const _test = test
      test = (...args) => {
        return _test.every((test, i) => {
          if (args[i] instanceof test) return true
          if (test === Number && typeof args[i] === 'number') return true
          if (test === String && typeof args[i] === 'string') return true
          if (test === Boolean && typeof args[i] === 'boolean') return true
        })
      }
    }
    if (test(...args)) return map(...args)
  }
}

const forEachFlow = (...args) => {
  let [flows, cb] = poly(
    args,
    [[Function], cb => [ctx.flows, cb]],
    [[Array, Function], (flows, cb) => [flows, cb]]
  )
  if (typeof flows[0] === 'number') flows = flows.map(i => ctx.flows[i])
  flows.forEach(cb)
}

const boundaryFlows = boundary => {
  return [].concat(
    ...boundary.map(b => ctx.nodes[ctx.boundaries[b].node].flows)
  )
}

const withBoundaryValues = (...args) => {
  const cb = args.pop()
  const boundaries = args.map(group => group.map(i => ctx.boundaries[i]))

  cb(...boundaries)
}

const resetBoundaryValues = () => {
  ctx.boundaries.forEach(boundary => {
    for (const k in ctx.attributes) boundary[k] = 0
  })
}

const applyDirection = () => {
  let attr
  for (const k in ctx.attributes) if (ctx.attributes[k].direction) attr = k

  ctx.boundaries.forEach(b => {
    if (b.directionFixed) {
      ctx.nodes[b.node].flows.forEach(i => {
        ctx.flows[i][attr] = Math.max(ctx.flows[i][attr], Number.EPSILON)
      })
    }
  })
  ctx.flows.forEach(f => {
    if (f[attr] < 0) {
      const a = f.a
      f.a = f.b
      f.b = a
      f[attr] *= -1
    }
  })
}

const transfer = (...args) => {
  let [flows, attr, direction, weight] = poly(
    args,
    [
      [String, String, Function],
      (attr, direction, weight) => [ctx.flows, attr, direction, weight]
    ],
    [
      [Array, String, String, Function],
      (flows, attr, direction, weight) => [flows, attr, direction, weight]
    ]
  )
  if (typeof flows[0] === 'number') flows = flows.map((i = ctx.flows[i]))
  const forward = direction === 'forward'

  let flowsA = flows
  let valueA = new Array(flowsA.length).fill(0)
  let flowsB
  let valueB = {}
  let boundariesC
  let valueC = {}

  // if transfer involves every flow, values match order of "ctx.flows" & "ctx.boundaries"
  if (flowsA.length === ctx.flows.length) {
    flowsB = new Array(ctx.flows.length).fill().map((_, i) => i)
    valueB = new Array(ctx.flows.length).fill(0)
    boundariesC = new Array(ctx.boundaries.length).fill().map((_, i) => i)
    valueC = new Array(ctx.boundaries.length).fill(0)
  }

  flowsA.forEach((f, i) => {
    let ff
    ff = ctx.nodes[f[forward ? 'b' : 'a']].flows.map(i => flows[i])
    ff = ff.filter(ff => {
      if (ff.i === f.i) return false
      const reversed = ff.a === f.a || ff.b === f.b
      if (!weight.includeReversed && reversed) return false
      return true
    })
    const boundary = ctx.boundaries.find(b => b.node === f[forward ? 'b' : 'a'])
    const [va, vb, vc] = weight(f, ff, {attr, boundary})
    valueA[i] = va
    if (boundary) {
      if (!valueC[i]) valueC[i] = 0
      valueC[boundary.i] += vc
    } else {
      vb.forEach((vb, i) => {
        i = ff[i].i
        if (!valueB[i]) valueB[i] = 0
        valueB[i] += vb
      })
    }
  })

  flowsA = flowsA.map(f => f.i)

  if (flowsA.length !== ctx.flows.length) {
    flowsB = Object.keys(valueB)
    valueB = flowsB.map(i => valueB[i])
    boundariesC = Object.keys(valueC)
    valueC = boundariesC.map(i => valueC[i])
  }

  const container = {
    flows: {a: flowsA, b: flowsB},
    boundaries: {c: boundariesC},
    value: {a: valueA, b: valueB, c: valueC},
    done: false,
    apply: () => {
      if (!container.done) {
        flowsA.forEach(i => (ctx.flows[i][attr] += valueA[i]))
        flowsB.forEach(i => (ctx.flows[i][attr] += valueB[i]))
        boundariesC.forEach(i => (ctx.boundaries[i][attr] += valueC[i]))
      }
      container.done = true
      return container
    }
  }

  return container
}

const weightedSplit = (...args) => {
  let [getMag, getWeight, flags] = poly(
    args,
    [
      weight => ['function', 'string'].includes(typeof weight),
      (weight, ...flags) => [1, weight, flags]
    ],
    [
      (mag, weight) =>
        ['function', 'number'].includes(typeof mag) &&
        ['function', 'string'].includes(typeof weight),
      (mag, weight, ...flags) => [mag, weight, flags]
    ]
  )
  if (typeof getMag === 'number') {
    const mag = getMag
    getMag = () => mag
  }
  if (typeof getWeight === 'string') {
    const attr = getWeight
    getWeight = (f, ff) => ff.map(ff => ff[attr])
  }

  const weightedSplit = (f, ff, {attr, boundary}) => {
    const mag = f[attr] * getMag(f, ff)
    const weight = getWeight(f, ff)

    if (boundary) return [-mag, null, mag]

    let flowCount = ff.length
    if (flags.includes('includeReversed')) {
      ff.forEach((ff, i) => {
        const reversed = f.a === ff.a || f.b === ff.b
        if (reversed) {
          weight[i] = 0
          flowCount -= 1
        }
      })
    }

    const sum = weight.reduce((pv, v) => pv + v, 0)
    const delta = weight.map(w => (sum ? mag * (w / sum) : mag / flowCount))

    // if "includeReversed" and every flow is reversed, transfer is split evenly between reversed flows
    if (flags.includes('includeReversed')) {
      const flowCountReversed = ff.length - flowCount
      ff.forEach((ff, i) => {
        const reversed = f.a === ff.a || f.b === ff.b
        if (reversed) {
          delta[i] = flowCount ? 0 : -mag / flowCountReversed
        }
      })
    }

    return [-mag, delta]
  }
  weightedSplit.includeReversed = flags.includes('includeReversed')
  return weightedSplit
}

const evenSplit = (...args) => {
  let [getMag, flags] = poly(
    args,
    [
      mag => ['function', 'number'].includes(typeof mag),
      (mag, ...flags) => [mag, flags]
    ],
    [() => true, (...flags) => [1, flags]]
  )
  if (typeof getMag === 'number') {
    const mag = getMag
    getMag = () => mag
  }
  const evenSplit = (f, ff, {attr, boundary}) => {
    const mag = f[attr] * getMag(f, ff)

    if (boundary) return [-mag, null, mag]

    const ffLength = ff.length
    const delta = ff.map(ff => {
      const reversed = f.a === ff.a || f.b === ff.b
      let d = mag / ffLength
      if (reversed) d *= -1
      return d
    })

    return [-mag, delta]
  }
  evenSplit.includeReversed = flags.includes('includeReversed')
  return evenSplit
}

export {
  setContext,
  Attribute,
  Node,
  Flow,
  Boundary,
  selectIndex,
  select,
  transaction,
  normalise,
  forEachFlow,
  boundaryFlows,
  withBoundaryValues,
  resetBoundaryValues,
  applyDirection,
  transfer,
  weightedSplit,
  evenSplit
}
