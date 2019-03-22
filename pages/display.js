;(function(target) {
  if (!target || !target.prototype) return
  target.prototype.arrow = function(startX, startY, endX, endY, controlPoints) {
    var dx = endX - startX
    var dy = endY - startY
    var len = Math.sqrt(dx * dx + dy * dy)
    var sin = dy / len
    var cos = dx / len
    var a = []
    a.push(0, 0)
    for (var i = 0; i < controlPoints.length; i += 2) {
      var x = controlPoints[i]
      var y = controlPoints[i + 1]
      a.push(x < 0 ? len + x : x, y)
    }
    a.push(len, 0)
    for (var i = controlPoints.length; i > 0; i -= 2) {
      var x = controlPoints[i - 2]
      var y = controlPoints[i - 1]
      a.push(x < 0 ? len + x : x, -y)
    }
    a.push(0, 0)
    this.beginPath()
    for (var i = 0; i < a.length; i += 2) {
      var x = a[i] * cos - a[i + 1] * sin + startX
      var y = a[i] * sin + a[i + 1] * cos + startY
      if (i === 0) this.moveTo(x, y)
      else this.lineTo(x, y)
    }
    this.closePath()
  }
})(global.CanvasRenderingContext2D)
;(function(target) {
  if (!target || !target.prototype) return
  target.prototype.diamond = function(x, y, width, height) {
    this.beginPath()
    this.moveTo(x, y - height / 2)
    this.lineTo(x - width / 2, y)
    this.lineTo(x, y + height / 2)
    this.lineTo(x + width / 2, y)
    this.closePath()
  }
})(global.CanvasRenderingContext2D)

const log = v => {
  const sgn = v > 0 ? 1 : -1
  v = Math.log(Math.abs(v) + 1)
  return v * sgn
}

const sigmoid = value => 2 / (1 + Math.exp(-value * 10000000)) - 1

const arrowSize = 8
const arrowColor = value => {
  value = sigmoid(value)
  const h = value > 0 ? '220' : '10'
  const s = Math.abs(value * 100)
  const l = 50 + Math.abs(value * 30)
  return `hsl(${h}, ${s}%, ${l}%)`
}
const border = 15
const scale = 100

const Canvas = ({world}) => {
  const {config, flows = [], nodes = [], inputs = [], outputs = []} = world
  const ref = React.useRef()

  const canvasWidth = config.width * scale + border * 2
  const canvasHeight = config.height * scale + border * 2

  React.useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    const max = log(flows.reduce((pv, f) => Math.max(pv, Math.abs(f.w)), 0))

    flows.forEach(({a, b, w, v}) => {
      let {x: xa, y: ya} = nodes[a]
      let {x: xb, y: yb} = nodes[b]
      w = (log(w) / max) * arrowSize
      xa = xa * scale + border
      xb = xb * scale + border
      ya = ya * scale + border
      yb = yb * scale + border

      const shape = w > 0 ? [1, 0, -w * 2, w] : [-w * 2, -w, -1, 0]
      ctx.fillStyle = arrowColor(v)
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

    ctx.fillStyle = 'red'
    outputs.forEach(i => {
      let {x, y} = nodes[i]
      x = x * scale + border
      y = y * scale + border

      ctx.diamond(x, y, arrowSize * 2, arrowSize * 2.2)
      ctx.fill()
    })
  })

  return (
    <canvas
      style={{border: '1px solid #ccc'}}
      width={canvasWidth}
      height={canvasHeight}
      ref={ref}
    />
  )
}

export default Canvas
