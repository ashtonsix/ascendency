import './shapes'

const log = v => {
  const sgn = v > 0 ? 1 : -1
  v = Math.log(Math.abs(v) + 1)
  return v * sgn
}

const sigmoid = value => 2 / (1 + Math.exp(-value)) - 1

const arrowColor = (value, bias, intensity) => {
  value = sigmoid(value * intensity)
  const h = value > 0 ? '220' : '10'
  const s = Math.abs(value * 100)
  const l = 50 + Math.abs(value * 30)
  const a = bias ? 40 : 100
  return `hsla(${h}, ${s}%, ${l}%, ${a}%)`
}

const canvasSize = ({width, height, scale, border}) => ({
  width: width * scale + border * 2,
  height: height * scale + border * 2
})

const paint = (canvas, state, options = {}) => {
  const ctx = canvas.getContext('2d')
  const {config, flows, nodes, inputs, outputs, plusBias, minusBias} = state
  let {scale, border, arrowSize, colorIntensity} = options
  arrowSize *= scale

  const canvasWidth = canvasSize({...config, scale, border}).width
  const canvasHeight = canvasSize({...config, scale, border}).height
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const max = log(flows.reduce((pv, f) => Math.max(pv, f.w), 0))

  flows.forEach(f => {
    let {x: xa, y: ya} = nodes[f.a]
    let {x: xb, y: yb} = nodes[f.b]
    let w = (log(f.w) / max) * arrowSize
    xa = xa * scale + border
    xb = xb * scale + border
    ya = ya * scale + border
    yb = yb * scale + border

    const shape = w > 0 ? [1, 0, -w * 2, w] : [-w * 2, -w, -1, 0]
    const bias = plusBias.includes(f.a) || minusBias.includes(f.a)
    ctx.fillStyle = arrowColor(f.v, bias, colorIntensity)
    ctx.arrow(xa, ya, xb, yb, shape)
    ctx.fill()
  })

  ctx.fillStyle = 'blue'
  inputs.forEach(i => {
    let {x, y} = nodes[i]
    x = x * scale + border
    y = y * scale + border

    ctx.diamond(x, y, arrowSize * 2, arrowSize * 2.2)
    ctx.fill()
  })

  ctx.fillStyle = 'blue'
  ;[...plusBias, ...minusBias].forEach(i => {
    let {x, y} = nodes[i]
    x = x * scale + border
    y = y * scale + border

    ctx.beginPath()
    ctx.arc(x, y, arrowSize, 0, 2 * Math.PI)
    ctx.fill()
  })

  ctx.fillStyle = 'red'
  outputs.forEach(i => {
    let {x, y} = nodes[i]
    x = x * scale + border
    y = y * scale + border

    ctx.diamond(x, y, arrowSize * 2, arrowSize * 2.2)
    ctx.fill()
  })
}

export {canvasSize}
export default paint
