import './shapes'

const log = v => {
  const sgn = v > 0 ? 1 : -1
  v = Math.log(Math.abs(v) + 1)
  return v * sgn
}

const sigmoid = value => 2 / (1 + Math.exp(-value)) - 1

const arrowColor = (value = 0, intensity) => {
  value = sigmoid(value * intensity)
  const h = value > 0 ? '220' : '10'
  const s = Math.abs(value * 100)
  const l = 50 + Math.abs(value * 30)
  return `hsl(${h}, ${s}%, ${l}%)`
}

const canvasSize = ({width, height, scale, border}) => ({
  width: 1100, // width * scale + border * 2,
  height: 800 // height * scale + border * 2
})

const paint = (canvas, state, options = {}) => {
  const ctx = canvas.getContext('2d')
  const {attributes, flows, nodes, boundaries = []} = state
  let {scale, border, arrowSize, colorIntensity} = options
  arrowSize *= scale

  const canvasWidth = canvasSize({scale, border}).width
  const canvasHeight = canvasSize({scale, border}).height
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const max = log(flows.reduce((pv, f) => Math.max(pv, f.weight), 0))

  flows.forEach(f => {
    let {x: xa, y: ya} = nodes[f.a]
    let {x: xb, y: yb} = nodes[f.b]
    let w = (log(f.weight) / max) * arrowSize
    xa = xa * scale + border
    xb = xb * scale + border
    ya = ya * scale + border
    yb = yb * scale + border

    const shape = w > 0 ? [1, 0, -w * 2, w] : [-w * 2, -w, -1, 0]
    ctx.fillStyle = arrowColor(f.value, colorIntensity)
    ctx.arrow(xa, ya, xb, yb, shape)
    ctx.fill()
  })

  boundaries.forEach(b => {
    let {x, y} = nodes[b.node]
    x = x * scale + border
    y = y * scale + border

    ctx.fillStyle = b.color
    switch (b.shape) {
      case 'diamond': {
        ctx.diamond(x, y, arrowSize * 2, arrowSize * 2.2)
        break
      }
      case 'circle': {
        ctx.beginPath()
        ctx.arc(x, y, arrowSize, 0, 2 * Math.PI)
        break
      }
    }
    ctx.fill()
  })
}

export {canvasSize}
export default paint
