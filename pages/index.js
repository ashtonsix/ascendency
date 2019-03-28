import React from 'react'
import Canvas from './display'
import init from './core/generate'
import loop, {sanitise} from './core/loop'
import useClock from './useClock'

import program from './programs/001-square.asc'

const initialWorld = sanitise(init(program))

const Simulation = ({children}) => {
  const [world, setWorld] = React.useState(initialWorld)
  const clock = useClock(() => setWorld(loop(world)), 100, true)
  global.world = world
  global.clock = clock
  return children(world)
}

const Container = () => {
  return (
    <div>
      <Simulation>{world => <Canvas world={world} />}</Simulation>
    </div>
  )
}

export default Container
