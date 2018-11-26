const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

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
  link: String,
  type: String,
  sport: String,
  courtName: String
});

const slotModel = mongoose.model('slot', slotSchema);

module.exports = slotModel;
