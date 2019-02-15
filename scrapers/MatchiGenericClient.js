const Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  { addScrape } = require('../models/metrics'),
  TimeSlot = require('../models/TimeSlot');

const baseUrl = `https://www.matchi.se/book/listSlots?wl=&sport=[sportId]&facility=[facilityId]&date=[year]-[month]-[day]`;
const sports = {
  1: 'Tennis',
  2: 'Badminton',
  3: 'Squash',
  4: 'Bordtennis',
  5: 'Padel'
};
module.exports = class MatchiGenericClient extends EventEmitter {
  constructor(club, delay) {
    super();
    this.club = club;
    Object.assign(this, delay);
  }

  async init() {
    const days = this.buildUrls(this.club);

    const context = {
      days,
      club: this.club,
      minDelay: this.minDelay,
      maxDelay: this.maxDelay,
      scraperCallback: this.parse
    };
    const slots = await Helper.slotRequestScheduler(context);
    this.emit(
      'slotsLoaded',
      Object.assign(
        {},
        { slots },
        { foundSlots: slots.length },
        { savedSlots: slots.length }
      )
    );
  }

  buildUrls(club) {
    return Object.keys(sports).reduce((acc, curr) => {
      const url = baseUrl
        .replace('[facilityId]', club.facilityId)
        .replace('[sportId]', curr);
      const a = Helper.getUrlsForNoOfDaysAhead(
        url,
        acc === 1 ? 14 : 7,
        club.name,
        club.id
      );
      return [
        ...acc,
        ...Helper.getUrlsForNoOfDaysAhead(
          url,
          acc === 1 ? 14 : 7,
          club.name,
          club.id
        )
      ];
    }, []);
  }

  async parse(targetDay, club) {
    try {
      addScrape.inc({
        club_name: club.tagName
      });
      let day = {};
      const $ = await Helper.getUrl(targetDay.url);
      $('.panel.panel-default.collapse').filter(function(a, b) {
        let startTime, startHours, startMinutes;
        const originalDate = new Date();
        $('.list-group-item > h6 strong', $(this).html()).filter(function(i) {
          if (i === 1) {
            startHours = Number($(this)[0].children[0].data);
            startMinutes = Number($(this)[0].children[1].children[0].data);
            originalDate.setHours(startHours);
            originalDate.setMinutes(startMinutes);
            startTime = Number(
              `${$(this)[0].children[0].data}.${
                $(this)[0].children[1].children[0].data
              }`
            );
          }
        });

        $('.list-group-item > table tr', $(this).html()).filter(function() {
          var element = $(this);
          const courtName = element.children()[0].children[0].data;
          const minutes = element.children()[1].children[0].data;
          let sport = element.children()[2].children[0].data;
          const surface = element.children()[3].children[0].data.trim();
          const link = `https://www.matchi.se${
            element.children()[5].children[1].attribs.href
          }`;
          const date = new Date(
            originalDate.getTime() + Number(minutes.substring(0, 2)) * 60000
          );
          const endTime = `${date.getHours()}.${date.getMinutes()}`;
          const key = startTime + '-' + endTime + '-' + courtName;

          if (!day.hasOwnProperty(key)) {
            const timeSlot = new TimeSlot(Number(startTime), Number(endTime));
            day[key] = new Slot(
              club.id,
              club.name,
              targetDay.timestamp,
              timeSlot,
              0,
              surface === 'Övrigt' ? 'uknownsurface' : surface,
              0,
              link,
              'inomhus',
              sport,
              courtName
            );
          }
        });
      });

      const slots = Object.keys(day).map(key => day[key]);
      if (slots.length > 0) {
        return await Helper.updateSlots(slots, club.id, targetDay.timestamp);
      } else {
        return [];
      }
    } catch (error) {
      console.error('There was an error scraping ' + club.url, error);
    }
  }
};
