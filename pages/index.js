import React from 'react'
import display from '../core/paint'
import Canvas from '../react/Canvas'
import useClock from '../react/useClock'

import program from '../programs/003-feedback'

const stopAt = 1500
const tickMs = 100
const displayOptions = {
  scale: 100,
  border: 15,
  arrowSize: 0.08,
  colorIntensity: 1e5
}

const initWorld = program()

const Simulation = ({children}) => {
  const [world, setWorld] = React.useState(initWorld)
  const clock = useClock(() => setWorld(program(world)), tickMs, true)
  if (world.time >= stopAt) clock.stop()
  global.world = world
  global.clock = clock
  return children(world)
}

const Container = () => {
  return (
    <div>
      <Simulation>
        {world => (
          <Canvas state={world} paint={display} options={displayOptions} />
        )}
      </Simulation>
    </div>
  )
}

export default Container
