const Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  TimeSlot = require('../models/TimeSlot')

module.exports = class MatchiPadelClient extends EventEmitter {
  constructor(club, delay) {
    super()
    this.club = club
    Object.assign(this, delay)
  }

  init() {
    this.repeater()
  }

  async repeater() {
    const days = Helper.getUrlsForNoOfDaysAhead(this.club.url, this.club.daysAhead, this.club.name, this.club.id)

    const context = {
      days,
      club: this.club,
      minDelay: this.minDelay,
      maxDelay: this.maxDelay,
      scraperCallback: this.parse
    }
    const slots = await Helper.slotRequestScheduler(context)
    const savedSlots = await Promise.all(slots.map(slot => Helper.saveSlot(slot.slotKey, slot._date, slot.timeSlot.startTime, slot.timeSlot.endTime, slot.clubId, slot.clubName, slot.price, slot.courtNumber, slot.surface, slot.link)))
    this.emit('slotsLoaded',
      Object.assign({}, { slots }, { foundSlots: slots.length }, { savedSlots: savedSlots.filter(x => x).length }))
    this.repeater()
  }

  async parse(targetDay, club) {
    try {
      const $ = await Helper.getUrl(targetDay.url)
      let day = {}
      $('button').filter(function () {
        var element = $(this)
        const text = element.text().trim().replace(/ /g, '').replace(/(\r\n|\n|\r)/gm, ''),
          court = 1,
          startTime = text.substring(0, 2),
          endTime = text.substring(2),
          key = startTime + '-' + endTime + '-' + court

        if (!day.hasOwnProperty(key)) {
          const timeSlot = new TimeSlot(Number(startTime.replace(':', '.')), Number(endTime.replace(':', '.')))
          day[key] = new Slot(club.id, club.name, targetDay.timestamp, timeSlot, court, '', 0, club.url)
        }
      })

      return Object.keys(day).map(key => day[key])
    } catch (error) {
      console.log('There was an error scraping ' + club.url, error)
    }
  }
}
