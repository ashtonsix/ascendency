const Canvas = ({width, height, paint, state, options}) => {
  const ref = React.useRef()

  React.useLayoutEffect(() => {
    global.canvas = ref.current
    paint(ref.current, state, options)
  })

  return <canvas style={{border: '1px solid #ccc'}} ref={ref} />
}

export default Canvas
