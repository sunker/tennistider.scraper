const HellasClient = require('./scrapers/HellasClient');
const MatchiClient = require('./scrapers/MatchiClient');
const MatchiPadelClient = require('./scrapers/MatchiPadelClient');
const EnskedeClient = require('./scrapers/EnskedeClient');
const MyCourtClient = require('./scrapers/MyCourtClient');
const settings = require('./settings');
const Helper = require('./scrapers/helper');
const rp = require('request-promise');

module.exports = {
  init() {
    // const enskedeClient = new EnskedeClient()
    // enskedeClient.init()

    const hellasClient = new HellasClient();
    hellasClient.init();
    this.initMycourt();
    this.repeatMatchi();
    this.repeatMatchiPadel();
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
  async repeatMatchi() {
    const matchiClubs = await rp(
      `${process.env.API_HOST}/api/club/${process.env.CLUB_PATH}`,
      {
        json: true
      }
    ).then(clubs => clubs.filter(club => club.tag === 'matchi'));
    const shuffledClubs = shuffle(matchiClubs);
    Promise.all(
      shuffledClubs.map(club => {
        return new Promise(resolve => {
          const delay = {
            minDelay: settings.matchiMinDelay * shuffledClubs.length,
            maxDelay: settings.matchiMaxDelay * shuffledClubs.length
          };
          const matchiClient = new MatchiClient(club, delay);
          setTimeout(
            () => matchiClient.init(),
            Helper.randomIntFromInterval(
              settings.matchiMinDelay,
              settings.matchiMaxDelay
            )
          );
          matchiClient.on('slotsLoaded', res => {
            console.log(
              `${res.foundSlots} slots (${res.savedSlots} new) found at ${
                club.name
              }`
            );
            resolve();
          });
        });
      }),
      () => this.repeatMatchi()
    ).then(() => this.repeatMatchi());
  },
  async repeatMatchiPadel() {
    const matchiPadelClubs = await rp(
      `${process.env.API_HOST}/api/club/${process.env.CLUB_PATH}`,
      {
        json: true
      }
    ).then(clubs => clubs.filter(club => club.tag === 'matchipadel'));
    const shuffledClubs = shuffle(matchiPadelClubs);
    Promise.all(
      shuffledClubs.map(club => {
        return new Promise(resolve => {
          const delay = {
            minDelay: settings.matchiPadelMinDelay * shuffledClubs.length,
            maxDelay: settings.matchiPadelMaxDelay * shuffledClubs.length
          };
          const matchiPadelClient = new MatchiPadelClient(club, delay);
          setTimeout(
            () => matchiPadelClient.init(),
            Helper.randomIntFromInterval(
              settings.matchiPadelMinDelay,
              settings.matchiPadelMaxDelay
            )
          );
          matchiPadelClient.on('slotsLoaded', res => {
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
