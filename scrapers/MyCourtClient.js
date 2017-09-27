const config = require('../config.json'),
  settings = require('../settings'),
  Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  cheerio = require('cheerio'),
  moment = require('moment'),
  club = require('../config.json').endpoints.myCourt,
  webdriver = require('selenium-webdriver'),
  until = webdriver.until,
  TimeSlot = require('../models/TimeSlot')

module.exports = class MyCourtClient extends EventEmitter {
  init() {
    this.initDriver()
    this.repeater()
  }

  async repeater() {
    this.logIn(config.endpoints.myCourt.loginUrl).then(async() => {
      this.scrapeClubsRecursively(Object.assign([], club.clubs.filter(x => x.include))).then((slots) => {
        this.repeater()
      })
    })
  }

  async scrapeClubsRecursively(clubs, slots = []) {
    return new Promise(resolve => {
      if (clubs.length > 0) {
        let target = clubs.shift()
        return this.openClubPage(target.myCourtClubId).then(async() => {
          try {
            const targets = await this.getAllTargets()
            const context = {
              days: targets,
              club: target,
              minDelay: settings.minDelay,
              maxDelay: settings.maxDelay,
              scraperCallback: this.scrapeDay,
              self: this
            }
            const daySlots = await Helper.slotRequestScheduler(context)
            const savedSlots = await Promise.all(daySlots.map(slot => Helper.saveSlot(slot.slotKey, slot._date, slot.timeSlot.startTime, slot.timeSlot.endTime, slot.clubId, slot.clubName, slot.price, slot.courtNumber, slot.surface, slot.link)))
            this.emit('slotsLoaded',
              Object.assign({}, { foundSlots: daySlots.length }, { savedSlots: savedSlots.filter(x => x).length }, { clubName: target.name }))
            slots = [...slots, ...daySlots]
            resolve(this.scrapeClubsRecursively(clubs, slots))
          } catch (error) {
            console.log(`There was an error scraping ${target.name}: ${error}`)
            return this.scrapeClubsRecursively({ clubs }, slots)
          }
        })
      } else {
        resolve(slots)
      }
    })
  };

  async openClubPage(clubId) {
    return new Promise((resolve, reject) => {
      this.driver.get(club.startPage).then(() => {
        setTimeout(() => {
          this.driver.executeScript('go_to_club(' + clubId + ',"sp",0)').then(() => {
            setTimeout(() => resolve(), 1000)
          })
        }, 1000)
      })
    })
  }

  async scrapeDay(day, club, self) {
    return new Promise(async(resolve, reject) => {
      let target
      try {
        target = await self.driver.findElement(webdriver.By.xpath("//div[@date='" + day.format1 + "']"))
      } catch (error) {
        try {
          target = await self.driver.findElement(webdriver.By.xpath("//div[@date='" + day.format2 + "']"))
        } catch (error) {
          return self.driver.findElement(webdriver.By.id('calender-next-week')).click().then(() => {
            resolve(self.scrapeDay(day, club, self))
          })
        }
      }
      target.click().then(() => {
        var me = self
        setTimeout(() => {
          me.driver.getPageSource().then((html) => {
            resolve(me.parse(cheerio.load(html), club, me, day))
          })
        }, 1000)
      })
    })
  }

  parseCourtNumber(element, $) {
    try {
      var columnId = element.closest('td').index()
      var columnHeader = $('[class="tableFloatingHeader"]').children()[columnId]
      const number = $('div', columnHeader).html().replace(/\D/g, '')
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
      return href.substring(start, start + 10)
    } catch (error) {
      console.log('Could not parse date from enskede day')
      return 'unknown date'
    }
  }

  parse($, club, self, { timestamp }) {
    try {
      let day = {}
      $('td.active ').each(function () {
        var element = $(this)

        const time = element.attr('court_time'),
          startTime = time.split('-')[0],
          endTime = time.split('-')[1],
          court = self.parseCourtNumber(element, $),
          key = startTime + '-' + endTime + '-' + court

        if (!day.hasOwnProperty(key)) {
          const timeSlot = new TimeSlot(Number(startTime), Number(endTime))
          day[key] = new Slot(club.id, club.name, timestamp, timeSlot, court, 'hardcourt', 0, club.bookingUrl)
        }
      })

      return Object.keys(day).map(key => day[key])
    } catch (error) {
      console.log('There was an error scraping ' + this.url ? this.url : '')
    }
  }

  async getAllTargets(elements = [], week = 3) {
    return new Promise(async resolve => {
      if (week !== 0) {
        const weekElements = await this.getElementsForWeek(week)
        return this.driver.findElement(webdriver.By.id('calender-next-week')).click().then(() => {
          resolve(this.getAllTargets([...elements, ...weekElements], --week))
        })
      } else {
        return this.driver.findElement(webdriver.By.id('calender-prev-week')).click()
          .then(() => this.driver.findElement(webdriver.By.id('calender-prev-week')).click()
            .then(() => this.driver.findElement(webdriver.By.id('calender-prev-week')).click()
              .then(() => resolve(elements.filter(x => this.dateInRange(x.timestamp))))))
      }
    })
  }

  dateInRange(date) {
    const today = new Date()
    const lastDate = new Date()
    today.setDate(today.getDate() + -1)
    lastDate.setDate(lastDate.getDate() + 13)

    return date.getTime() >= today.getTime() && date.getTime() <= lastDate.getTime()
  }

  async getElementsForWeek(week) {
    const dayElements = await this.driver.findElements(webdriver.By.xpath('//div[@date]'))
    return Promise.all(dayElements.map(async dayElement => {
      const date = await dayElement.getAttribute('date')
      const timestamp = date.indexOf('-') === 2 ? moment(date, 'DD-MM-YYYY').toDate() : moment(date, 'YYYY-MM-DD').toDate()
      return {
        week,
        timestamp,
        format1: moment(timestamp).format('DD-MM-YYYY'),
        format2: moment(timestamp).format('YYYY-MM-DD')
      }
    }))
  }

  initDriver() {
    try {
      this.driver = new webdriver.Builder()
        .forBrowser('chrome')
        .build()
    } catch (error) {
      console.log(error)
    }
  }

  async logIn(url) {
    return new Promise((resolve, reject) => {
      try {
        this.driver.get(url).then(async() => {
          const elements = await this.driver.findElements(webdriver.By.className(club.loginClasSelector)) // .then((elements) => {
          if (elements.length > 0) {
            elements[0].click().then(() => {
              this.driver.wait(until.elementLocated(webdriver.By.id('email')), 3000).then(() => {
                setTimeout(async() => {
                  this.driver.findElement(webdriver.By.id('email')).sendKeys(club.email)
                  this.driver.findElement(webdriver.By.id('password')).sendKeys(club.password)
                  const elems = await this.driver.findElements(webdriver.By.name('agree_terms_conditions'))
                  elems.forEach((element) => {
                    var elem = element
                    element.getAttribute('type').then((value) => {
                      if (value && value.toLowerCase() === 'checkbox') {
                        this.driver.executeScript('arguments[0].setAttribute(\'checked\', \'checkeed\')', elem)
                      }
                    })
                  })
                  setTimeout(async() => {
                    const elements = await this.driver.findElements(webdriver.By.className('button primary-button track-event'))
                    elements.forEach((element) => {
                      element.getAttribute('value').then((value) => {
                        if (value && value.toLowerCase() === 'logga in') {
                          element.click().then(() => {
                            resolve()
                          })
                        }
                      })
                    })
                  }, 1000)
                }, 1000)
              })
            })
          } else {
            // Already logged in
            this.driver.get(club.startPage).then(() => {
              resolve()
            })
          }
        })
      } catch (error) {
        console.log('There was an error logging in to mycourt: ' + error)
        reject()
      }
    })
  }
}
