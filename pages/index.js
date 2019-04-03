import React from 'react'
import init from '../core/generate'
import loop, {sanitise} from '../core/loop'
import display from '../core/paint'
import Canvas from '../react/Canvas'
import useClock from '../react/useClock'

import program from '../programs/006-boolean.asc'

const initialWorld = sanitise(init(program))

const stopAt = 300
const tickMs = 100
const displayOptions = {
  scale: 100,
  border: 15,
  arrowSize: 0.08,
  colorIntensity: 1e5
}

const Simulation = ({children}) => {
  const [world, setWorld] = React.useState(initialWorld)
  const clock = useClock(() => setWorld(loop(world)), tickMs, true)
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
