const Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  TimeSlot = require('../models/TimeSlot')

module.exports = class HellasClient extends EventEmitter {
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
    this.emit('slotsLoaded', { club: this.club, slots })

    this.repeater()
  }

  async parse($, targetDay, club) {
    try {
      let day = {}
      $('[class="slot free"]').filter(function () {
        const element = $(this)
        const titleArray = element.attr('title').split('<br>'),
          court = titleArray[1],
          time = titleArray[2],
          startTime = time.split('-')[0].trim(),
          endTime = time.split('-')[1].trim(),
          key = startTime + '-' + endTime + '-' + court

        if (titleArray[0].toLowerCase() === 'ledig' && !day.hasOwnProperty(key)) {

          day[key] = {
            timeSlot: new TimeSlot(Number(startTime.replace(':', '.')), Number(endTime.replace(':', '.'))),
            courtNumber: Number(court.toLowerCase().replace('bana', '').trim())
          }

          const courtNumber = Number(court.toLowerCase().replace('bana', '').trim())
          const timeSlot = new TimeSlot(Number(startTime.replace(':', '.')), Number(endTime.replace(':', '.')))
          day[key] = new Slot(club.id, club.name, targetDay.timestamp, timeSlot, courtNumber, courtNumber > 5 ? 'grus' : 'hardcourt', 0, club.url)
        }
      })

      return Object.keys(day).map(key => day[key])
    } catch (error) {
      console.log('There was an error scraping ' + this.url ? this.url : '')
    }
  }
}
