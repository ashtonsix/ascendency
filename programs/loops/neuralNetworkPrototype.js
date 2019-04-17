import * as $ from '../../core/lib'
import * as $$ from '../../core/extra'

const cancelBias = ctx => {}

const getPartialDerivatives = (output, target, amplify) => {
  const epsilon = 1e-7
  const slopes = output.map((_, i) => {
    const outputLo = [...output]
    const outputHi = [...output]
    outputLo[i] = outputLo[i] - epsilon
    outputHi[i] = outputHi[i] + epsilon
    const x = epsilon
    const y = amplify(outputHi, target) - amplify(outputLo, target)
    return y / x
  })
  return slopes
}

const createLoop = ({config, data, random, init}) => {
  const {
    predictionDelay,
    transferRate,
    cycleAspect,
    cycleLeak,
    valueDecay,
    slopeDecay,
    amplitude
  } = config

  const loop = ctx => {
    if (!ctx) {
      ctx = {
        time: 0,
        flows: [],
        nodes: [],
        boundaries: [],
        attributes: [],
        input: [],
        output: [],
        plusBias: [],
        minusBias: []
      }
      $.setContext(ctx)

      $.transaction(() => {
        $.Attribute('weight', {direction: true, value: () => random(-1, 1)})
        $.Attribute('value')
        $.Attribute('slope')
      })
      $.transaction(init)

      $.resetBoundaryValues()
      $.applyDirection()
      $.normalise('weight', {mean: 1})

      return ctx
    }
    ctx.time += 1

    const iteration = Math.floor(ctx.time / (predictionDelay * 4 + 1))
    $$.phased(
      ctx.time,
      predictionDelay,
      () => {
        $.transfer('value', 'forward', $.weightedSplit('weight')).apply()
        $.forEachFlow(f => (f.value = $$.activate(f.value)))
        $.forEachFlow(f => (f.value *= 1 - valueDecay))

        const valueInput = data[iteration % data.length].x
        $.forEachFlow(
          $.boundaryFlows(ctx.input),
          (f, i) => (f.value = valueInput[i])
        )
        $.forEachFlow($.boundaryFlows(ctx.plusBias), f => (f.value = f.weight))
        $.forEachFlow(
          $.boundaryFlows(ctx.minusBias),
          f => (f.value = -f.weight)
        )
      },
      predictionDelay,
      () => {
        $.transfer('slope', 'backward', $.weightedSplit('weight')).apply()
        $.forEachFlow(f => (f.slope *= slopeDecay))
      },
      predictionDelay,
      () => {
        const slopeSz = transferRate * (1 - cycleAspect)
        const weightSz = transferRate * (cycleAspect * (1 - cycleLeak))
        const evenSz = transferRate * (cycleAspect * cycleLeak)
        const slopeT = $.transfer(
          'weight',
          'backward',
          $.weightedSplit(slopeSz, (f, ff) => {
            let weight
            const min = Math.min(...ff.map(ff => ff.value))
            weight = ff.map(ff => ff.value - min)
            if (f.slope < 0) {
              const max = Math.max(...weight)
              weight = weight.map(v => -v + max)
            }
            return weight
          })
        )
        const weightT = $.transfer(
          'weight',
          'backward',
          $.weightedSplit(weightSz, 'weight', 'includeReversed')
        )
        const evenT = $.transfer(
          'weight',
          'backward',
          $.evenSplit(evenSz, 'includeReversed')
        )
        slopeT.apply()
        weightT.apply()
        evenT.apply()
      },
      predictionDelay,
      () => {
        $.transfer('value', 'forward', $.weightedSplit('weight')).apply()
        $.forEachFlow(f => (f.value = $$.activate(f.value)))
        $.forEachFlow(f => (f.value *= 1 - valueDecay))
      },
      1,
      () => {
        $.forEachFlow(f => (f.slope = 0))
      }
    )

    $.withBoundaryValues(
      [...ctx.input, ...ctx.plusBias, ...ctx.minusBias],
      ctx.output,
      (input, output) => {
        const iteration = Math.floor(ctx.time / (predictionDelay * 4 + 1))
        const valueTarget = data[iteration % data.length].y
        const valueOutput = output.map(t => t.value)

        const score = $$.amplify(valueOutput, valueTarget, amplitude)
        const IOSent = input.reduce((pv, t) => pv + t.weight * score, 0)
        const slopeOutput = getPartialDerivatives(
          valueOutput,
          valueTarget,
          (vo, vt) => $$.amplify(vo, vt, amplitude)
        )
        const slopeMin = Math.min(...slopeOutput)

        const weightBy = slopeOutput.map(s => s - slopeMin)
        const weightBySum = weightBy.reduce((pv, v) => pv + v, 0)
        const delta = weightBy.map(
          v => IOSent * (weightBySum ? v / weightBySum : 1 / weightBy.length)
        )
        $.forEachFlow($.boundaryFlows(ctx.output), (f, i) => {
          f.weight += delta[i]
          f.slope += slopeOutput[i]
        })
      }
    )

    $.resetBoundaryValues()
    $.applyDirection()
    $.normalise('weight', {mean: 1})

    return ctx
  }

  return loop
}

export default createLoop
