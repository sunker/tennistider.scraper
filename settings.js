var dev = process.env.NODE_ENV === 'debug';
module.exports = Object.freeze({
  minDelay: dev ? 1 : 6000,
  maxDelay: dev ? 5 : 20000,
  matchiMinDelay: dev ? 1000 : 15000,
  matchiMaxDelay: dev ? 5000 : 25000,
  // matchiMinDelay: 100,
  // matchiMaxDelay: 500,
  matchiPadelMinDelay: dev ? 1000 : 20000,
  matchiPadelMaxDelay: dev ? 5000 : 40000
});
