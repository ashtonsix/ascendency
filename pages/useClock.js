import React from 'react'

const useClock = ({loop}) => {
  const [time, setTime] = React.useState(0)
  const [stopped, setStopped] = React.useState(false)

  const tick = () => {
    setTime(t => t + 1)
    loop(time)
    if (!stopped) global.requestAnimationFrame(tick)
  }

  const start = () => {
    if (!stopped) global.requestAnimationFrame(tick)
    setStopped(false)
  }

  const stop = () => {
    setStopped(true)
  }

  React.useEffect(() => {
    start()
  }, [])

  return {time, start, stop}
}

export default useClock
