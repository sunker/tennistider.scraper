const client = require('prom-client');

module.exports = {
  addScrape: new client.Counter({
    name: 'scrapes_total',
    help: 'The number of scrapes made.',
    labelNames: ['club_name']
  }),
  addSlot: new client.Counter({
    name: 'slots_found',
    help: 'Slots found',
    labelNames: ['club_name']
  }),
  addNewSlot: new client.Counter({
    name: 'new_slots_found',
    help: 'New Slots found',
    labelNames: ['club_name']
  })
};
