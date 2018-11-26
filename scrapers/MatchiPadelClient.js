const Slot = require('../models/Slot.js'),
  EventEmitter = require('events').EventEmitter,
  Helper = require('./helper.js'),
  TimeSlot = require('../models/TimeSlot');

module.exports = class MatchiPadelClient extends EventEmitter {
  constructor(club, delay) {
    super();
    this.club = club;
    Object.assign(this, delay);
  }

  async init() {
    const days = Helper.getUrlsForNoOfDaysAhead(
      this.club.url,
      this.club.daysAhead,
      this.club.name,
      this.club.id
    );

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

  async parse(targetDay, club) {
    try {
      const $ = await Helper.getUrl(targetDay.url);
      let day = {};
      $('.panel.panel-default.collapse').filter(function(a, b) {
        let startTime, startHours, startMinutes;
        const originalDate = new Date();
        $('.list-group-item > h6 strong').filter(function(i) {
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

        $('.list-group-item > table tr').filter(function() {
          var element = $(this);
          const courtName = element.children()[0].children[0].data;
          const minutes = element.children()[1].children[0].data;
          let sport = element.children()[2].children[0].data;
          const surface = element.children()[3].children[0].data;
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
              surface,
              0,
              club.url,
              'inomhus',
              'padel',
              courtName
            );
          }
        });
      });

      const slots = Object.keys(day).map(key => day[key]);
      return Helper.updateSlots(slots, club.id, targetDay.timestamp);
    } catch (error) {
      console.error('There was an error scraping ' + club.url, error);
    }
  }
};
