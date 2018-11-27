const settings = require('../settings'),
  Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  TimeSlot = require('../models/TimeSlot'),
  rp = require('request-promise');

module.exports = class HellasClient extends EventEmitter {
  init() {
    this.repeater();
  }

  async repeater() {
    const club = await rp({
      uri: `${process.env.API_HOST}/api/club/list-current`,
      json: true
    }).then(clubs => clubs.find(club => club.tag === 'hellas'));
    let days = Helper.getUrlsForNoOfDaysAhead(
      club.url,
      club.daysAhead,
      club.name,
      club.id
    );
    const context = {
      days,
      club,
      minDelay: settings.hellasMinDelay,
      maxDelay: settings.hellasMaxDelay,
      scraperCallback: this.parse
    };

    const slots = await Helper.slotRequestScheduler(context);
    this.repeater(slots);
  }

  async parse(targetDay, club) {
    try {
      const $ = await Helper.getUrl(targetDay.url);
      let day = {};
      $(club.selectors.root).filter(function() {
        const element = $(this);
        const time = $(club.selectors.time, element).html();
        element.children().each((columnIndex, activitySelctor) => {
          const activityValue = $(
            club.selectors.activity,
            activitySelctor
          ).html();
          if (activityValue && activityValue.toLowerCase() === 'boka') {
            const court = $(
                club.selectors.court.replace('[columnIndex]', columnIndex + 1)
              ).html(),
              startTime = time.split('-')[0],
              endTime = time.split('-')[1],
              key = time + '-' + court,
              aElement = $(activitySelctor).html(),
              start = aElement.indexOf('href="') + 'href="'.length,
              end = aElement.indexOf('"', start + 1),
              url = (
                'http://www.commodusnet.net/kund/' +
                aElement.substring(start, end)
              ).replace('//', '/');

            if (!day.hasOwnProperty(key)) {
              const courtNumber = Number(
                court
                  .toLowerCase()
                  .replace('bana', '')
                  .trim()
              );
              const timeSlot = new TimeSlot(
                Number(startTime.replace(':', '.')),
                Number(endTime.replace(':', '.'))
              );
              day[key] = new Slot(
                club.id,
                club.name,
                targetDay.timestamp,
                timeSlot,
                courtNumber,
                courtNumber > 6 ? 'grus' : 'hardcourt',
                0,
                url.replace(/&amp;/g, '&'),
                'inomhus',
                'Tennis'
              );
            }
          }
        });
      });

      const slots = Object.keys(day).map(key => day[key]);
      const newSlots = await Helper.updateSlots(
        slots,
        club.id,
        targetDay.timestamp
      );
      return newSlots;
    } catch (error) {
      console.error('There was an error scraping ' + club.name, error);
    }
  }
};
