import React from 'react'
import Canvas from './display'
import init from './core/generate'
import loop from './core/loop'
import useClock from './useClock'

import grid from './programs/002-grid.asc'

const Simulation = ({children}) => {
  const [world, setWorld] = React.useState(init(grid))
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
