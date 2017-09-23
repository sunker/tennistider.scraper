require('dotenv').config()
const Koa = require('koa'),
  Router = require('koa-router'),
  koaErrorhandler = require('./middleware/errorHandler'),
  koaHealth = require('./middleware/health'),
  mongoose = require('mongoose'),
  // a = require('./models/User'),
  // User = mongoose.model('user'),
  app = new Koa(),
  router = new Router()

app.use(koaHealth)
app.use(koaErrorhandler)

mongoose.connect(process.env.MONGO_CLIENT, (err) => {
  if (err) console.log(err)
  else console.log('Connected to database')
})

app.use(router.routes())
app.use(router.allowedMethods())
app.listen(process.env.SERVICE_PORT || '3010')
