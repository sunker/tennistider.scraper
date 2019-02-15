const settings = require('../settings'),
  Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  cheerio = require('cheerio'),
  { addScrape } = require('../models/metrics'),
  moment = require('moment'),
  webdriver = require('selenium-webdriver'),
  until = webdriver.until,
  TimeSlot = require('../models/TimeSlot'),
  rp = require('request-promise');

module.exports = class EnskedeClient extends EventEmitter {
  init() {
    this.initDriver();
    this.repeater();
  }

  async repeater() {
    const club = await rp({
      uri: `${process.env.API_HOST}/api/club/list-current`,
      json: true
    }).then(clubs => clubs.find(club => club.tag === 'enskede'));
    try {
      await this.loadSessionUrl(club, 'Tennis 60');
    } catch (error) {
      this.repeater();
    }
  }

  async loadSessionUrl(club, activityName) {
    try {
      this.driver
        .manage()
        .window()
        .setSize(440, 1280);
      await this.driver.get(
        'https://www.enskederackethall.se/Onlinebokning.html'
      );
      const elements = await this.driver.wait(
        until.elementLocated(webdriver.By.id('PASTELLDATA_WRAPPER_IFRAME_0')),
        5000
      );
      const sessionUrl = await elements.getAttribute('src');
      await this.driver.get(sessionUrl);
      await this.selectActivity(activityName, club);
      let element = await this.driver.wait(
        until.elementLocated(webdriver.By.id('ResourceBookingSchemaPanel')),
        5000
      );

      const surface = activityName === 'Tennis 60' ? 'hardcourt' : 'grus';
      let html = await element.getAttribute('innerHTML');
      await this.parse(cheerio.load(html), surface, this, club);
      await this.clickButton(false);
      element = await this.driver.findElement(
        webdriver.By.id('ResourceBookingSchemaPanel')
      );
      html = await element.getAttribute('innerHTML');
      await this.parse(cheerio.load(html), surface, this, club);
      await this.clickButton(true);
    } catch (error) {
      console.error(error);
    } finally {
      this.restartSession(club, activityName);
    }
  }

  async restartSession(club, activityName) {
    setTimeout(async () => {
      await this.driver.quit();
      this.initDriver();
      this.loadSessionUrl(
        club,
        activityName === 'Tennis 60' ? 'Grustennis 60' : 'Tennis 60'
      );
    }, 5000);
  }

  async goForward() {
    return this.driver.findElement(
      webdriver.By.js(function() {
        return document.querySelector(
          '.ResourceBookingDateChangeDirection.CustomerBookingDateChangeDirection.CustomerBookingDateChangeNext.PButton'
        );
      })
    );
  }

  async goBack() {
    return this.driver.findElement(
      webdriver.By.js(function() {
        return document.querySelector(
          '.ResourceBookingDateChangeDirection.CustomerBookingDateChangeDirection.CustomerBookingDateChangePrevious.PButton'
        );
      })
    );
  }

  async clickButton(back = true) {
    return new Promise(async resolve => {
      const nextElement = await (back ? this.goBack() : this.goForward());
      await nextElement.click();

      setTimeout(async () => {
        await this.driver.wait(
          until.elementLocated(webdriver.By.id('ResourceBookingSchemaPanel')),
          5000
        );
        resolve();
      }, 3000);
    });
  }

  async parse($, surface, self, club) {
    try {
      let result = {};
      $('.RBFree.RBTTActive > div div form').filter(function() {
        const element = $(this);
        const dateAndTime = element.children()[0].attribs.value;
        const date = dateAndTime.substring(0, 10);
        const startTime = dateAndTime.substring(11, 16);
        const duration = element
          .parent()
          .children()[1]
          .firstChild.data.trim();

        const [price] = element
          .parent()
          .children()[4]
          .firstChild.data.trim()
          .split(' ');
        console.log(surface, 'surface');

        addScrape.inc({
          club_name: club.tagName
        });

        const timestamp = new Date(date);
        const timeSlot = new TimeSlot(Number(startTime.replace(':', '.')));
        const courtNumber = 0;
        const slot = new Slot(
          club.id,
          club.name,
          timestamp,
          timeSlot,
          courtNumber,
          surface,
          Number(price.replace(',', '.')),
          club.bookingUrl,
          'inomhus',
          'tennis'
        );

        if (!result.hasOwnProperty(date)) {
          result[date] = [slot];
        } else {
          result[date] = [...result[date], slot];
        }
      });

      return await Promise.all(
        Object.keys(result).map(async key => {
          console.log(`${result[key].length} slots found on ${key}`);
          return await Helper.updateSlots(result[key], club.id, new Date(key));
        })
      );
    } catch (error) {
      console.error('There was an error scraping ' + this.url ? this.url : '');
      return;
    }
  }

  initDriver() {
    try {
      this.driver = new webdriver.Builder()
        .forBrowser('phantomjs')
        // .forBrowser('chrome')
        .build();
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  }

  async selectActivity(activityName, club) {
    try {
      const dropdown = await this.driver.wait(
        this.driver.findElement(
          webdriver.By.id(
            'InfoObject_NoneLabelFor_RadioActivityTimeFilterCombo'
          )
        ),
        5000
      );
      await dropdown.click();
      const elements = await this.driver.findElements(
        webdriver.By.className('pdradiobox_parent')
      );
      elements.forEach(async element => {
        const value = await element.getAttribute('pd-infoobject-context-name');
        if (value && value === activityName) {
          const parent = await element.findElement(webdriver.By.xpath('..'));
          await parent.click();
          await element.click();
        }
      });
    } catch (error) {
      console.error(error);
    } finally {
      this.restartSession(club, activityName);
    }
  }
};
