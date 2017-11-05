require('dotenv').config()
require('./models/MongoSlot')
const Koa = require('koa'),
  Router = require('koa-router'),
  bodyparser = require('koa-bodyparser'),
  koaErrorhandler = require('./middleware/errorHandler'),
  koaHealth = require('./middleware/health'),
  mongoose = require('mongoose'),
  listener = require('./listener'),
  app = new Koa(),
  router = new Router()

console.log('process.env.NODE_ENV', process.env.NODE_ENV)

app.use(bodyparser())
app.use(koaHealth)
app.use(koaErrorhandler)

mongoose.connect(process.env.MONGO_CLIENT, { useMongoClient: true }).then(
  () => console.log('Connected to database'),
  (err) => {
    console.log('Could not connect to database: ', err)
    process.exit(1)
  })

listener.init()

app.use(router.routes())
app.use(router.allowedMethods())
app.listen(process.env.PORT || '3010')
