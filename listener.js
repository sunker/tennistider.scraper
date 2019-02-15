const MatchiGenericClient = require('./scrapers/MatchiGenericClient');
const EnskedeClient = require('./scrapers/EnskedeClient');
const MyCourtClient = require('./scrapers/MyCourtClient');
const settings = require('./settings');
const Helper = require('./scrapers/helper');
const rp = require('request-promise');

module.exports = {
  init() {
    // const enskedeClient = new EnskedeClient();
    // enskedeClient.init();

    // this.initMycourt();
    this.repeatMatchiGeneric();
  },
  async initMycourt() {
    const myCourtClient = new MyCourtClient();
    myCourtClient.init();
    myCourtClient.on('slotsLoaded', ({ foundSlots, savedSlots, clubName }) => {
      console.log(
        `${foundSlots} slots (${savedSlots} new) found at ${clubName}`
      );
    });
  },
  async repeatMatchiGeneric() {
    const matchiV2Clubs = await rp(
      `${process.env.API_HOST}/api/club/v2/${process.env.CLUB_PATH}`,
      {
        json: true
      }
    ).then(clubs => clubs.filter(club => club.tag === 'matchi'));

    const shuffledClubs = shuffle(matchiV2Clubs);
    Promise.all(
      shuffledClubs.map(club => {
        return new Promise(resolve => {
          const delay = {
            minDelay: settings.matchiMinDelay * shuffledClubs.length,
            maxDelay: settings.matchiMaxDelay * shuffledClubs.length
          };
          // const delay = {
          //   minDelay: settings.matchiPadelMinDelay,
          //   maxDelay: settings.matchiPadelMaxDelay
          // };
          const matchiGenericClient = new MatchiGenericClient(club, delay);
          setTimeout(
            () => matchiGenericClient.init(),
            Helper.randomIntFromInterval(
              settings.matchiPadelMinDelay,
              settings.matchiPadelMaxDelay
            )
          );
          matchiGenericClient.on('slotsLoaded', res => {
            console.log(
              `${res.foundSlots} slots (${res.savedSlots} new) found at ${
                club.name
              }`
            );
            resolve();
          });
        });
      }),
      () => this.repeatMatchiPadel()
    ).then(() => this.repeatMatchiPadel());
  }
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
