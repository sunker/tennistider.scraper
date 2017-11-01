const settings = require('../settings'),
  Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  cheerio = require('cheerio'),
  moment = require('moment'),
  webdriver = require('selenium-webdriver'),
  until = webdriver.until,
  TimeSlot = require('../models/TimeSlot'),
  rp = require('request-promise')

module.exports = class EnskedeClient extends EventEmitter {
  init() {
    this.initDriver()
    this.repeater()
  }

  async repeater() {
    const club = await rp({ uri: `${process.env.API_HOST}/api/club/list-current`, json: true }).then(clubs => clubs.find(club => club.tag === 'enskede'))
    const url = await this.loadSessionUrl(club)
    const dayButtons = await this.openSession(club, url)
    const targets = this.getTargets(club.daysAhead, dayButtons)
    const context = {
      days: targets,
      club,
      minDelay: settings.minDelay,
      maxDelay: settings.maxDelay,
      scraperCallback: this.scrapeDay,
      self: this
    }
    try {
      const slots = await Helper.slotRequestScheduler(context)
      this.repeater(slots)
    } catch (error) {
      this.repeater()
    }
  }

  async scrapeDay(day, club, self) {
    return new Promise((resolve, reject) => {
      self.driver.findElement(webdriver.By.xpath("//option[@value='" + day.timestampFormatted + "']")).click().then(() => {
        self.driver.wait(until.elementLocated(webdriver.By.id(club.tableContainerSelectorId)), 3000).then(() => {
          setTimeout(async () => {
            try {
              const target = await self.driver.findElement(webdriver.By.id(club.tableContainerSelectorId))
              const html = await target.getAttribute('innerHTML')
              resolve(self.parse(cheerio.load(html), day, self, club))
            } catch (error) {
              resolve([])
            }
          }, 1000)
        })
      }, (err) => {
        console.log(err)
        resolve([])
      }).catch(err => {
        console.log(err)
        resolve([])
      })
    })
  }

  getSurface(courtNumber) {
    let surface = 'grus'
    if (courtNumber === 1 || courtNumber === 2) {
      surface = 'inomhusgrus'
    } else if (courtNumber > 30 && courtNumber < 36) {
      surface = 'hardcourt'
    }
    return surface
  }

  async parse($, target, self, club) {
    try {
      let day = {}
      const me = self
      $('[class="ResBookSchemaTableBookButton"]').filter(function () {
        const element = $(this)
        let court = me.parseCourtNumber(element, $),
          date = me.parseDate(element)

        const time = element.html().replace('Boka ', '').replace(':', '-'),
          startTime = time.trim(),
          key = startTime + '-' + court

        if (!day.hasOwnProperty(key)) {
          const timeSlot = new TimeSlot(Number(startTime.replace('-', '.')))
          const courtNumber = Number(court.toLowerCase().replace('bana', '').replace('grustennis', '').trim())
          const surface = me.getSurface(courtNumber)
          day[key] = new Slot(club.id, club.name, date, timeSlot, courtNumber, surface, 0, club.bookingUrl)
        }
      })
      const slots = Object.keys(day).map(key => day[key])
      return await Helper.updateSlots(slots, club.id, club.date)
    } catch (error) {
      console.log('There was an error scraping ' + this.url ? this.url : '')
    }
  }

  parseCourtNumber(element, $) {
    try {
      const columnId = element.closest('td').index()
      const columnHeader = $('[class="ResBookTableRowHeader"]').children()[columnId]
      const number = $('span', columnHeader).html().replace(/\D/g, '')
      return number || columnId
    } catch (error) {
      console.log('Could not parse court number from enskede day')
      return 'unknown courtnumber'
    }
  }

  parseDate(element) {
    try {
      const href = element.attr('href')
      const start = href.indexOf('DATEHR=') + 'DATEHR='.length
      return new Date(href.substring(start, start + 10))
    } catch (error) {
      console.log('Could not parse date from enskede day')
      return 'unknown date'
    }
  }

  getTargets(noOfDaysAhead) {
    var targets = []
    let currentDate = new Date()
    for (var index = 0; index < noOfDaysAhead; index++) {
      var timestamp = new Date(currentDate.getTime())
      targets.push({
        timestamp,
        timestampFormattedInversed: moment(timestamp).format('DD-MM-YYYY'),
        timestampFormatted: moment(timestamp).format('YYYY-MM-DD')
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }
    return targets
  }

  initDriver() {
    try {
      this.driver = new webdriver.Builder()
        .forBrowser('phantomjs')
        // .forBrowser('chrome')
        .build()
    } catch (error) {
      console.log(error)
    }
  };

  async loadSessionUrl(club) {
    return this.driver.get(club.baseUrl).then(() =>
      this.driver.wait(until.elementLocated(webdriver.By.id(club.formSelectorId)), 2000).then(() =>
        this.driver.findElement(webdriver.By.id(club.formSelectorId)).getAttribute('action')
      )
    )
  }

  async openSession(club, url) {
    return new Promise((resolve) => {
      return this.driver.get(url).then(() => {
        this.driver.wait(until.elementLocated(webdriver.By.id(club.tennisButtonSelectorId)), 2000).then(() => {
          this.driver.findElement(webdriver.By.id(club.tennisButtonSelectorId)).click().then(() => {
            this.driver.wait(until.elementLocated(webdriver.By.id(club.tableContainerSelectorId)), 2000).then(() => {
              resolve()
            }, (err) => {
              console.log(err)
              resolve(this.openSession(club, url))
            }).catch(err => {
              console.log(err)
              resolve(this.openSession(club, url))
            })
          }, () => resolve(this.openSession(club, url)))
        }, () => resolve(this.openSession(club, url)))
      }, () => resolve(this.openSession(club, url)))
    })
  }
}
