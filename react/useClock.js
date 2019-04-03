import React from 'react'

const useClock = (cb, intervalDuration, startImmediate = false) => {
  const [time, setTime] = React.useState(0)
  const [isRunning, setIsRunning] = React.useState(startImmediate)

  const start = () => {
    setIsRunning(true)
  }

  const stop = () => {
    if (isRunning) {
      setIsRunning(false)
    }
  }

  const onInterval = () => {
    setTime(t => t + 1)
    cb()
  }

  React.useEffect(() => {
    if (isRunning) {
      const _intervalId = setInterval(onInterval, intervalDuration)
      return () => clearInterval(_intervalId)
    }
  }, [isRunning])

  return {
    time,
    start,
    stop
  }
}

export default useClock
