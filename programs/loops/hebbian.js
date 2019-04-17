const hebbian = () => {
  const t = $.transfer('value', 'forward', $.weightedSplit('weight'))
  const d = t.value.b
  $.transfer(
    'weight',
    'backward',
    $.weightedSplit(transferRate, (f, ff) => {
      return ff.map(ff => {
        const similarity = 1 / (ff.value - d[f.i] + 1e-7)
        return ff.map(ff => ff.value * similarity)
      })
    })
  ).apply()
  t.apply()
}
