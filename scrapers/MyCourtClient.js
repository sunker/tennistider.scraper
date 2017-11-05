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

module.exports = class MyCourtClient extends EventEmitter {
  init() {
    this.initDriver()
    this.repeater()
  }

  async repeater() {
    this.logIn('http://www.mycourt.se/index.php').then(async () => {
      const clubs = await rp({ uri: `${process.env.API_HOST}/api/club/list-current`, json: true }).then(clubs => clubs.filter(club => club.tag === 'mycourt'))
      this.scrapeClubsRecursively(clubs).then((slots) => {
        this.repeater()
      })
    })
  }

  async scrapeClubsRecursively(clubs, slots = []) {
    return new Promise(resolve => {
      if (clubs.length > 0) {
        let target = clubs.shift()
        return this.openClubPage(target.myCourtClubId).then(async () => {
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
      this.driver.get('http://www.mycourt.se/your_clubs.php').then(() => {
        setTimeout(() => {
          this.driver.executeScript('go_to_club(' + clubId + ',"sp",0)').then(() => {
            setTimeout(() => resolve(), 1000)
          })
        }, 2000)
      })
    })
  }

  async scrapeDay(day, club, self) {
    return new Promise(async (resolve, reject) => {
      let target
      try {
        target = await self.driver.findElement(webdriver.By.xpath("//div[@date='" + day.format1 + "']"))
      } catch (error) {
        try {
          target = await self.driver.findElement(webdriver.By.xpath("//div[@date='" + day.format2 + "']"))
        } catch (error) {
          return self.clickNext().then(() => {
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
      console.log('Could not parse court number from my court day')
      return 'unknown courtnumber'
    }
  }

  getCourtInfo(club, court) {
    try {
      const result = {
        surface: 'hardcourt',
        type: 'inomhus',
        court
      }
      Object.keys(club.courts).forEach(courtGroupKey => {
        const startCourt = Number(courtGroupKey.split('-')[0])
        const endCourt = Number(courtGroupKey.split('-')[1])
        if (court >= startCourt && court <= endCourt) {
          result.surface = club.courts[courtGroupKey].surface
          result.type = club.courts[courtGroupKey].type
        }
      })
      return result
    } catch (error) {
      console.log('Could not parse court number from my court day')
      return {
        surface: 'hardcourt',
        type: 'inomhus',
        court
      }
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

  async parse($, club, self, { timestamp }) {
    try {
      let day = {}
      $('td.active ').each(function () {
        var element = $(this)

        const time = element.attr('court_time'),
          startTime = time.split('-')[0],
          endTime = time.split('-')[1],
          court = self.parseCourtNumber(element, $),
          courtInfo = self.getCourtInfo(club, court),
          key = startTime + '-' + endTime + '-' + court

        if (!day.hasOwnProperty(key)) {
          const timeSlot = new TimeSlot(Number(startTime), Number(endTime))
          day[key] = new Slot(club.id, club.name, timestamp, timeSlot, court, courtInfo.surface, 0, club.bookingUrl, courtInfo.type)
        }
      })

      const slots = Object.keys(day).map(key => day[key])
      return await Helper.updateSlots(slots, club.id, timestamp)
    } catch (error) {
      console.log('There was an error scraping ' + this.url ? this.url : '')
    }
  }

  scheduleRestart(error = '', time = 1800000) {
    setTimeout(() => {
      console.log(`Scheduled restart after error: ${error}`)
      process.exit(1)
    }, time)
  }

  async clickNext() {
    try {
      return this.driver.findElement(webdriver.By.xpath("//*[@src='images/arrow_rgt.png']"), console.log).click().catch(console.log)
    } catch (error) {
      this.scheduleRestart(error)
    }
  }

  async clickPrevious() {
    return this.driver.findElement(webdriver.By.xpath("//*[@src='images/arrow_lft.png']")).click()
  }

  async getAllTargets(elements = [], week = 3) {
    return new Promise(async resolve => {
      if (week !== 0) {
        const weekElements = await this.getElementsForWeek(week)
        return this.clickNext().then(() => {
          resolve(this.getAllTargets([...elements, ...weekElements], --week))
        })
      } else {
        return this.clickPrevious()
          .then(() => this.clickPrevious()
            .then(() => this.clickPrevious()
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
        .forBrowser('phantomjs')
        //.forBrowser('chrome')
        .build()
      this.driver.manage().window().setSize(1920, 1080)
    } catch (error) {
      console.log(error)
      process.exit(1)
    }
  }

  async logIn(url) {
    return new Promise((resolve, reject) => {
      this.driver.get(url).then(async () => {
        const elements = await this.driver.findElements(webdriver.By.className('button small-button signin-button')) // .then((elements) => {
        if (elements.length > 0) {
          elements[0].click().then(() => {
            this.driver.wait(until.elementLocated(webdriver.By.id('email')), 3000).then(() => {
              setTimeout(async () => {
                this.driver.findElement(webdriver.By.id('email')).sendKeys(process.env.MAIL_ADDRESS)
                this.driver.findElement(webdriver.By.id('password')).sendKeys(process.env.MAIL_PASS)
                const elems = await this.driver.findElements(webdriver.By.name('agree_terms_conditions'))
                elems.forEach((element) => {
                  var elem = element
                  element.getAttribute('type').then((value) => {
                    if (value && value.toLowerCase() === 'checkbox') {
                      this.driver.executeScript('arguments[0].setAttribute(\'checked\', \'checkeed\')', elem)
                    }
                  })
                })
                setTimeout(async () => {
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
          this.driver.get('http://www.mycourt.se/index.php').then(() => {
            resolve()
          })
        }
      })
    })
  }
}
