const settings = require('../settings'),
  Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  cheerio = require('cheerio'),
  webdriver = require('selenium-webdriver'),
  until = webdriver.until,
  TimeSlot = require('../models/TimeSlot'),
  rp = require('request-promise');

module.exports = class MyCourtClient extends EventEmitter {
  init() {
    this.initDriver();
    this.repeater();
  }

  async repeater() {
    this.logIn('http://www.mycourt.se/index.php').then(async () => {
      const clubs = await rp({
        uri: `${process.env.API_HOST}/api/club/${process.env.CLUB_PATH}`,
        json: true
      }).then(clubs => clubs.filter(club => club.tag === 'mycourt'));
      this.scrapeClubsRecursively(clubs).then(slots => {
        this.repeater();
      });
    });
  }

  async scrapeClubsRecursively(clubs, slots = []) {
    return new Promise(resolve => {
      if (clubs.length > 0) {
        let target = clubs.shift();
        return this.openClubPage(target.myCourtClubId).then(async () => {
          try {
            const targets = await this.getAllTargets();
            const context = {
              days: targets,
              club: target,
              minDelay: settings.minDelay,
              maxDelay: settings.maxDelay,
              // minDelay: 10,
              // maxDelay: 1000,
              scraperCallback: this.scrapeDay,
              self: this
            };
            const daySlots = await Helper.slotRequestScheduler(context);
            slots = [...slots, ...daySlots];
            resolve(this.scrapeClubsRecursively(clubs, slots));
          } catch (error) {
            console.error(
              `There was an error scraping ${target.name}: ${error}`
            );
            return this.scrapeClubsRecursively({ clubs }, slots);
          }
        });
      } else {
        resolve(slots);
      }
    });
  }

  async openClubPage(clubId) {
    return new Promise((resolve, reject) => {
      this.driver.get('http://www.mycourt.se/your_clubs.php').then(() => {
        setTimeout(() => {
          this.driver
            .executeScript('go_to_club(' + clubId + ',"sp",0)')
            .then(() => {
              setTimeout(() => resolve(), 1000);
            });
        }, 2000);
      });
    });
  }

  async scrapeDay(day, club, self) {
    await self.driver.get(day.url);
    const html = await self.driver.getPageSource();
    const result = await self.parse(cheerio.load(html), club, self, day);
    return result;
  }

  parseCourtNumber(element, $) {
    try {
      var columnId = element.closest('td').index();
      var columnHeader = $('[class="tableFloatingHeader"]').children()[
        columnId
      ];
      const number = $('div', columnHeader)
        .html()
        .replace(/\D/g, '');
      return number || columnId;
    } catch (error) {
      console.error('Could not parse court number from my court day');
      return 'unknown courtnumber';
    }
  }

  getCourtInfo(club, court) {
    try {
      const result = {
        surface: 'hardcourt',
        type: 'inomhus',
        court
      };
      Object.keys(club.courts).forEach(courtGroupKey => {
        const startCourt = Number(courtGroupKey.split('-')[0]);
        const endCourt = Number(courtGroupKey.split('-')[1]);
        if (court >= startCourt && court <= endCourt) {
          result.surface = club.courts[courtGroupKey].surface;
          result.type = club.courts[courtGroupKey].type;
        }
      });
      return result;
    } catch (error) {
      console.error('Could not parse court number from my court day');
      return {
        surface: 'hardcourt',
        type: 'inomhus',
        court
      };
    }
  }

  async parse($, club, self, { timestamp }) {
    try {
      let day = {};
      $('td.active ').each(function() {
        var element = $(this);

        const time = element.attr('court_time'),
          startTime = time.split('-')[0],
          endTime = time.split('-')[1],
          court = self.parseCourtNumber(element, $),
          courtInfo = self.getCourtInfo(club, court),
          key = startTime + '-' + endTime + '-' + court;

        if (!day.hasOwnProperty(key)) {
          const timeSlot = new TimeSlot(Number(startTime), Number(endTime));
          day[key] = new Slot(
            club.id,
            club.name,
            timestamp,
            timeSlot,
            court,
            courtInfo.surface,
            0,
            club.bookingUrl,
            courtInfo.type
          );
        }
      });

      const slots = Object.keys(day).map(key => day[key]);
      return await Helper.updateSlots(slots, club.id, timestamp);
    } catch (error) {
      console.error('There was an error scraping ' + this.url ? this.url : '');
    }
  }

  scheduleRestart(error = '', time = 1800000) {
    setTimeout(() => {
      console.error(`------- Scheduled restart after error: ${error}`);
      process.exit(1);
    }, time);
  }

  async getAllTargets(noOfDaysAhead = 14) {
    var currentDate = new Date();
    var targets = [];
    for (var index = 0; index < noOfDaysAhead; index++) {
      var timestamp = new Date(currentDate.getTime());
      targets.push({
        url: `https://www.mycourt.se/table_cust.php?wo_today=${timestamp
          .getTime()
          .toString()
          .substring(0, 10)}`,
        timestamp: timestamp,
        date: currentDate.getDate(),
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear()
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return targets;
  }

  initDriver() {
    try {
      this.driver = new webdriver.Builder()
        .forBrowser('phantomjs')
        // .forBrowser('chrome')
        .build();
      this.driver
        .manage()
        .window()
        .setSize(1920, 1080);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  }

  async logIn(url) {
    return new Promise((resolve, reject) => {
      this.driver.get(url).then(async () => {
        const elements = await this.driver.findElements(
          webdriver.By.className('button small-button signin-button')
        ); // .then((elements) => {
        if (elements.length > 0) {
          elements[0].click().then(() => {
            this.driver
              .wait(until.elementLocated(webdriver.By.id('email')), 3000)
              .then(() => {
                setTimeout(async () => {
                  this.driver
                    .findElement(webdriver.By.id('email'))
                    .sendKeys(process.env.MAIL_ADDRESS);
                  this.driver
                    .findElement(webdriver.By.id('password'))
                    .sendKeys(process.env.MAIL_PASS);
                  const elems = await this.driver.findElements(
                    webdriver.By.name('agree_terms_conditions')
                  );
                  elems.forEach(element => {
                    var elem = element;
                    element.getAttribute('type').then(value => {
                      if (value && value.toLowerCase() === 'checkbox') {
                        this.driver.executeScript(
                          "arguments[0].setAttribute('checked', 'checkeed')",
                          elem
                        );
                      }
                    }); // table_cust.php?today=1539786244059
                    //                         1539699564846
                  });
                  setTimeout(async () => {
                    const elements = await this.driver.findElements(
                      webdriver.By.className(
                        'button primary-button track-event'
                      )
                    );
                    elements.forEach(element => {
                      element.getAttribute('value').then(value => {
                        if (value && value.toLowerCase() === 'logga in') {
                          element.click().then(() => {
                            resolve();
                          });
                        }
                      });
                    });
                  }, 1000);
                }, 1000);
              });
          });
        } else {
          // Already logged in
          this.driver.get('http://www.mycourt.se/index.php').then(() => {
            resolve();
          });
        }
      });
    });
  }
};
