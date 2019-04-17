import * as $ from '../../core/lib'

const createLoop = ({config, random, init}) => {
  const {transferRate, leakRate} = config
  const normalRate = 1 - leakRate

  const loop = ctx => {
    if (!ctx) {
      ctx = {time: 0, flows: [], nodes: [], boundaries: [], attributes: []}
      $.setContext(ctx)
      $.transaction(() => {
        $.Attribute('weight', {direction: true, value: () => random(-1, 1)})
      })
      $.transaction(init)
      $.applyDirection()
      $.normalise('weight', {mean: 1})
      return ctx
    }
    ctx.time += 1

    $.transfer(
      'weight',
      'forward',
      $.weightedSplit(transferRate * normalRate, 'weight', 'includeReversed')
    ).apply()

    $.transfer(
      'weight',
      'forward',
      $.evenSplit(transferRate * leakRate, 'weight', 'includeReversed')
    ).apply()

    $.applyDirection()
    $.normalise('weight', {mean: 1})

    return ctx
  }

  return loop
}

export default createLoop
