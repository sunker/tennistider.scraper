const HellasClient = require('./scrapers/HellasClient')
const MatchiClient = require('./scrapers/MatchiClient')
const MatchiPadelClient = require('./scrapers/MatchiPadelClient')
const EnskedeClient = require('./scrapers/EnskedeClient')
const MyCourtClient = require('./scrapers/MyCourtClient')
const config = require('./config.json')
const settings = require('./settings')
const Helper = require('./scrapers/helper')
const rp = require('request-promise')

module.exports = {
  init() {
    // const hellasClient = new HellasClient()
    // if (config.endpoints.hellas.include) {
    //   hellasClient.init()
    // }
    // hellasClient.on('slotsLoaded', (res) => {
    //   console.log(`${res.foundSlots} slots (${res.savedSlots} new) found at Hellas TK`)
    // })

    // const enskedeClient = new EnskedeClient()
    // if (config.endpoints.enskede.include) {
    //   enskedeClient.init()
    // }
    // enskedeClient.on('slotsLoaded', (res) => {
    //   console.log(`${res.foundSlots} slots (${res.savedSlots} new) found at Enskede`)
    // })


    this.initMycourt()
    // this.repeatMatchi()
    // this.repeatMatchiPadel()
  },
  async initMycourt() {
    const myCourtClient = new MyCourtClient()
    myCourtClient.init()
    myCourtClient.on('slotsLoaded', ({ foundSlots, savedSlots, clubName }) => {
      console.log(`${foundSlots} slots (${savedSlots} new) found at ${clubName}`)
    })
  },
  async repeatMatchi() {
    const matchiClubs = await rp({ uri: `${process.env.API_HOST}/api/club/list-current`, json: true }).then(clubs => clubs.filter(club => club.tag === 'matchi'))
    Promise.all(matchiClubs.map(club => {
      return new Promise((resolve) => {
        const delay = { minDelay: settings.matchiMinDelay * matchiClubs.length, maxDelay: settings.matchiMaxDelay * matchiClubs.length }
        const matchiClient = new MatchiClient(club, delay)
        setTimeout(() => matchiClient.init(), Helper.randomIntFromInterval(settings.matchiMinDelay, settings.matchiMaxDelay))
        matchiClient.on('slotsLoaded', (res) => {
          console.log(`${res.foundSlots} slots (${res.savedSlots} new) found at ${club.name}`)
          resolve()
        })
      })
    }), () => this.repeatMatchi()).then(() => this.repeatMatchi())
  },
  async repeatMatchiPadel() {
    const matchiPadelClubs = await rp({ uri: `${process.env.API_HOST}/api/club/list-current`, json: true }).then(clubs => clubs.filter(club => club.tag === 'matchipadel'))
    Promise.all(matchiPadelClubs.map(club => {
      return new Promise(resolve => {
        const delay = { minDelay: settings.matchiPadelMinDelay * matchiPadelClubs.length, maxDelay: settings.matchiPadelMaxDelay * matchiPadelClubs.length }
        const matchiPadelClient = new MatchiPadelClient(club, delay)
        setTimeout(() => matchiPadelClient.init(), Helper.randomIntFromInterval(settings.matchiPadelMinDelay, settings.matchiPadelMaxDelay))
        matchiPadelClient.on('slotsLoaded', (res) => {
          console.log(`${res.foundSlots} slots (${res.savedSlots} new) found at ${club.name}`)
          resolve()
        })
      })
    }), () => this.repeatMatchiPadel()).then(() => this.repeatMatchiPadel())
  }
}
