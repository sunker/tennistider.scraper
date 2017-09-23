const mongoose = require('mongoose'),
  Schema = mongoose.Schema

const slotSchema = new Schema({
  id: {
    type: Schema.ObjectId
  },
  key: {
    type: String,
    required: true,
    unique: true,
    index: {
      unique: true
    }
  },
  date: Date,
  startTime: Number,
  endTime: Number,
  clubId: Number,
  clubName: String,
  price: Number,
  courtNumber: Number,  
  surface: String,
  link: String
})

module.exports = mongoose.model('slot', slotSchema)
