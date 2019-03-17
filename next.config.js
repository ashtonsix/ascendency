module.exports = {
  webpack: config => {
    config.module.rules.push({
      test: /\.asc$/,
      use: 'raw-loader'
    })

    return config
  }
}
