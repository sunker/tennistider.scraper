module.exports = async(ctx, next) => {
  if (ctx.url === '/health') {
    const seconds = process.uptime()
    const hh = Math.floor(seconds / (60 * 60))
    const mm = Math.floor(seconds % (60 * 60) / 60)
    const ss = Math.floor(seconds % 60)
    return ctx.body = {
      status: 'ok',
      ut: `${hh}:${mm}:${ss}`,
      service: process.env.npm_package_name,
      version: process.env.npm_package_version,
      scope: process.env.SCOPE
    }
  }

  await next()
}
