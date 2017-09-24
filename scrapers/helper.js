const cheerio = require('cheerio')
const rp = require('request-promise')
const mongoose = require('mongoose')
const Slots = mongoose.model('slot')
const Slot = require('../models/MongoSlot')

module.exports = class Helper {
  static async getUrl(url) {
    const html = await rp(url)
    const $html = cheerio.load(html)
    return $html
  }

  static async slotRequestScheduler(ctx, slots = []) {
    return new Promise((resolve, reject) => {
      const { days, minDelay, maxDelay, scraperCallback, club, self } = ctx
      if (days.length > 0) {
        let day = days.shift()
        setTimeout(async() => {
          let daySlots = []
          try {
            daySlots = await scraperCallback(day, club, self)
            console.log(`${day.url ? day.url : day.timestampFormatted}: ${daySlots.length} slots found`)
            slots = [...slots, ...daySlots]
          } catch (error) {
            console.log('Could not scrape day', error)
          }
          resolve(Helper.slotRequestScheduler(ctx, slots))
        }, Helper.randomIntFromInterval(minDelay, maxDelay))
      } else {
        resolve(slots)
      }
    })
  }

  static insertUrlDates(url, date) {
    url = url.replace('[year]', date.getFullYear())
    url = url.replace('[month]', date.getMonth() + 1)
    url = url.replace('[day]', date.getDate())

    return url
  };

  static randomIntFromInterval(min, max) {
    const random = Math.floor(Math.random() * (max - min + 1) + min)
    return random
  };

  static getUrlsForNoOfDaysAhead(rawUrl, noOfDaysAhead, name, clubId) {
    var currentDate = new Date()
    var targets = []
    for (var index = 0; index < noOfDaysAhead; index++) {
      var timestamp = new Date(currentDate.getTime())
      var url = Helper.insertUrlDates(rawUrl, currentDate)
      targets.push({
        clubId: clubId,
        url: url,
        name: name,
        timestamp: timestamp,
        date: currentDate.getDate(),
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear()
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return targets
  }

  static async saveSlot(key, date, startTime, endTime, clubId, clubName, price, courtNumber, surface, link) {
    const slot = new Slot({
      key,
      date,
      startTime,
      endTime,
      clubId,
      clubName,
      price,
      courtNumber,
      surface,
      link
    })
    return new Promise(resolve => {
      Slots.findOne({ key: slot.key }, (err, docs) => {
        if (err || docs) {
          resolve(false)
        } else {
          slot.save().then((res) => {
            resolve(true)
          }, () => false).catch(err => {
            if (err && err.code !== 11000) {
              console.log(err)
            }
            resolve(false)
          })
        }
      })
    })
  }
}
