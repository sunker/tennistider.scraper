require('dotenv').config()
const Koa = require('koa'),
  Router = require('koa-router'),
  koaErrorhandler = require('./middleware/errorHandler'),
  koaHealth = require('./middleware/health'),
  mongoose = require('mongoose'),
  listener = require('./listener'),
  app = new Koa(),
  router = new Router()

app.use(koaHealth)
app.use(koaErrorhandler)

mongoose.connect(process.env.MONGO_CLIENT, { useMongoClient: true }).then(
  () => console.log('Connected to database'),
  (err) => console.log('Could not connect to database: ', err))

listener.init()

app.use(router.routes())
app.use(router.allowedMethods())
app.listen(process.env.SERVICE_PORT || '3010')
