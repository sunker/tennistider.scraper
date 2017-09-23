module.exports = async(ctx, next) => {
  try {
    await next()
  } catch (err) {
    const unhandledError = err.stack
    const unauthorized = err.status === 401
    ctx.body = unhandledError ? { error: unauthorized ? 'unauthorized' : 'unhandled error' } : err
    ctx.status = err.status || 400
  }
}
