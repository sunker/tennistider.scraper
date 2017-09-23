const config = require('../config.json'),
  settings = require('../settings'),
  Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  selectors = require('../config.json').endpoints.hellas.selectors,
  club = require('../config.json').endpoints.hellas,
  TimeSlot = require('../models/TimeSlot')

module.exports = class HellasClient extends EventEmitter {
  init() {
    this.repeater()
  }

  async repeater() {
    let days = Helper.getUrlsForNoOfDaysAhead(config.endpoints.hellas.url, config.endpoints.hellas.daysAhead, config.endpoints.hellas.name)
    const context = {
      days,
      club: config.endpoints.hellas,
      minDelay: settings.hellasMinDelay,
      maxDelay: settings.hellasMaxDelay,
      scraperCallback: this.parse
    }
    const slots = await Helper.slotRequestScheduler(context)
    slots.forEach(slot => Helper.saveSlot(slot.slotKey, slot._date, slot.timeSlot.startTime, slot.timeSlot.endTime, slot.clubId, slot.clubName, slot.price, slot.courtNumber, slot.surface, slot.link))
    this.emit('slotsLoaded', slots)
    this.repeater()
  }

  async parse(targetDay) {
    try {
      const $ = await Helper.getUrl(targetDay.url)
      let day = {}
      $(selectors.root).filter(function () {
        const element = $(this)
        const time = $(selectors.time, element).html()
        element.children().each((columnIndex, activitySelctor) => {
          const activityValue = $(selectors.activity, activitySelctor).html()
          if (activityValue && activityValue.toLowerCase() === 'boka') {
            const court = $(selectors.court.replace('[columnIndex]', columnIndex)).html(),
              startTime = time.split('-')[0],
              endTime = time.split('-')[1],
              key = time + '-' + court,
              aElement = $(activitySelctor).html(),
              start = aElement.indexOf('href="') + 'href="'.length,
              end = aElement.indexOf('"', start + 1),
              url = ('http://www.commodusnet.net/kund/' + aElement.substring(start, end)).replace('//', '/')

            if (!day.hasOwnProperty(key)) {
              const courtNumber = Number(court.toLowerCase().replace('bana', '').trim())
              const timeSlot = new TimeSlot(Number(startTime.replace(':', '.')), Number(endTime.replace(':', '.')))
              day[key] = new Slot(club.id, club.name, targetDay.timestamp, timeSlot, courtNumber, courtNumber > 6 ? 'grus' : 'hardcourt', 0, url.replace(/&amp;/g, '&'))
            }
          }
        })
      })

      return Object.keys(day).map(key => day[key])
    } catch (error) {
      console.log('There was an error scraping ' + this.url ? this.url : '')
    }
  }
}
