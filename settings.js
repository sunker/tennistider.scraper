var dev = process.env.NODE_ENV === 'debug'
module.exports = Object.freeze({
  minDelay: dev ? 1 : 6000,
  maxDelay: dev ? 5 : 20000,
  hellasMinDelay: dev ? 1 : 3000,
  hellasMaxDelay: dev ? 3 : 10000,
  matchiMinDelay: dev ? 1000 : 6000,
  matchiMaxDelay: dev ? 5000 : 20000
})
