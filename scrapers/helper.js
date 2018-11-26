const cheerio = require('cheerio');
const rp = require('request-promise');
const mongoose = require('mongoose');
const Slots = mongoose.model('slot');
const Slot = require('../models/MongoSlot');

module.exports = class Helper {
  static async getUrl(url) {
    const html = await rp(url);
    const $html = cheerio.load(html);
    return $html;
  }

  static async slotRequestScheduler(ctx, slots = []) {
    return new Promise((resolve, reject) => {
      const { days, minDelay, maxDelay, scraperCallback, club, self } = ctx;
      if (days.length > 0) {
        let day = days.shift();
        setTimeout(async () => {
          let daySlots = [];
          try {
            daySlots = await scraperCallback(day, club, self);
            console.log(
              `${club.name}: ${day.timestamp ? day.timestamp : day.url}: ${
                daySlots.length
              } new slot(s) found`
            );
            slots = [...slots, ...daySlots];
          } catch (error) {
            console.error('Could not scrape day', error);
          }
          resolve(Helper.slotRequestScheduler(ctx, slots));
        }, Helper.randomIntFromInterval(minDelay, maxDelay));
      } else {
        resolve(slots);
      }
    });
  }

  static insertUrlDates(url, date) {
    url = url.replace('[year]', date.getFullYear());
    url = url.replace('[month]', date.getMonth() + 1);
    url = url.replace('[day]', date.getDate());

    return url;
  }

  static randomIntFromInterval(min, max) {
    const random = Math.floor(Math.random() * (max - min + 1) + min);
    return random;
  }

  static getUrlsForNoOfDaysAhead(rawUrl, noOfDaysAhead, name, clubId) {
    var currentDate = new Date();
    var targets = [];
    for (var index = 0; index < noOfDaysAhead; index++) {
      var timestamp = new Date(currentDate.getTime());
      var url = Helper.insertUrlDates(rawUrl, currentDate);
      targets.push({
        clubId: clubId,
        url: url,
        name: name,
        timestamp: timestamp,
        date: currentDate.getDate(),
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear()
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return targets;
  }

  static async updateSlots(slots, clubId, date) {
    // const matchiPadelClubIds = await rp(
    //   `${process.env.API_HOST}/api/club/list`,
    //   {
    //     json: true
    //   }
    // ).then(clubs =>
    //   clubs.filter(club => club.tag === 'matchipadel').map(c => c.id)
    // );
    // const padelSlotsToBeDeleted = await rp({
    //   uri: `${
    //     process.env.API_HOST
    //   }/api/slot/upcoming-by-clubs?clubs=${matchiPadelClubIds.join(',')}`,
    //   json: true
    // });

    // await rp({
    //   uri: `${process.env.API_HOST}/api/slot/many`,
    //   method: 'DELETE',
    //   json: true,
    //   body: padelSlotsToBeDeleted
    // });

    //Delete enskede
    // const padelSlotsToBeDeleted = await rp({
    //   uri: `${process.env.API_HOST}/api/slot/upcoming-by-clubs?clubs=20`,
    //   json: true
    // });

    // await rp({
    //   uri: `${process.env.API_HOST}/api/slot/many`,
    //   method: 'DELETE',
    //   json: true,
    //   body: padelSlotsToBeDeleted
    // });

    const currentSlotsOfTheDay = await rp({
      uri: `${process.env.API_HOST}/api/slot/filter`,
      qs: { clubId, date },
      json: true
    });
    const slotsToBeDeleted = currentSlotsOfTheDay.filter(
      x => slots.some(y => y.slotKey === x.key) === false
    );
    if (slotsToBeDeleted.length > 0) {
      await rp({
        uri: `${process.env.API_HOST}/api/slot/many`,
        method: 'DELETE',
        json: true,
        body: slotsToBeDeleted
      });
    }
    return rp({
      uri: `${process.env.API_HOST}/api/slot/many`,
      method: 'POST',
      json: true,
      body: slots
    });
  }

  static async saveSlot(
    key,
    date,
    startTime,
    endTime,
    clubId,
    clubName,
    price,
    courtNumber,
    surface,
    link,
    type
  ) {
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
      link,
      type
    });
    return new Promise(resolve => {
      Slots.findOne({ key: slot.key }, (err, docs) => {
        if (err || docs) {
          resolve(false);
        } else {
          slot.save(function(err) {
            if (err) {
              if (err.code !== 11000) {
                console.error(err);
              }
              resolve(false);
            } else {
              resolve(true);
            }
          });
        }
      });
    });
  }
};
