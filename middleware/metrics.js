const prometheus = require('prom-client')

module.exports = async(ctx, next) => {

  prometheus.collectDefaultMetrics(1000)

  if (ctx.url === '/metrics') {
    return ctx.body = prometheus.register.metrics()
  }

  await next()
}
