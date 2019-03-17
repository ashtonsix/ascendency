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
    for (var i = 0; i < a.length; i += 2) {
      var x = a[i] * cos - a[i + 1] * sin + startX
      var y = a[i] * sin + a[i + 1] * cos + startY
      if (i === 0) this.moveTo(x, y)
      else this.lineTo(x, y)
    }
  }
})(global.CanvasRenderingContext2D)

const log = v => {
  const sgn = v > 0 ? 1 : -1
  v = Math.log(Math.abs(v) + 1)
  return v * sgn
}

const arrowSize = 8
const arrowColor = 'rgba(90, 90, 90)'
const border = 10
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

    ctx.fillStyle = arrowColor

    const max = log(flows.reduce((pv, f) => Math.max(pv, Math.abs(f.w)), 0))

    flows.forEach(({a, b, w}) => {
      let {x: xa, y: ya} = nodes[a]
      let {x: xb, y: yb} = nodes[b]
      w = (log(w) / max) * arrowSize
      xa = xa * scale + border
      xb = xb * scale + border
      ya = ya * scale + border
      yb = yb * scale + border

      const shape = w > 0 ? [1, 0, -w * 2, w] : [-w * 2, -w, -1, 0]
      ctx.beginPath()
      ctx.arrow(xa, ya, xb, yb, shape)
      ctx.fill()
    })
  })

  return <canvas width={canvasWidth} height={canvasHeight} ref={ref} />
}

export default Canvas
