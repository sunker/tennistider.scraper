const HellasClient = require('./scrapers/HellasClient')
const MatchiClient = require('./scrapers/MatchiClient')
const MatchiPadelClient = require('./scrapers/MatchiPadelClient')
const EnskedeClient = require('./scrapers/EnskedeClient')
const MyCourtClient = require('./scrapers/MyCourtClient')
const config = require('./config.json')
const settings = require('./settings')
const Helper = require('./scrapers/helper')

module.exports = {
  init() {
    const hellasClient = new HellasClient()
    if (config.endpoints.hellas.include) {
      hellasClient.init()
    }
    hellasClient.on('slotsLoaded', (res) => {
      console.log(`${res.foundSlots} slots (${res.savedSlots} new) found at Hellas TK`)
    })

    const enskedeClient = new EnskedeClient()
    if (config.endpoints.enskede.include) {
      enskedeClient.init()
    }
    enskedeClient.on('slotsLoaded', (res) => {
      console.log(`${res.foundSlots} slots (${res.savedSlots} new) found at Enskede`)
    })

    const myCourtClient = new MyCourtClient()
    if (config.endpoints.myCourt.include) {
      myCourtClient.init()
    }
    myCourtClient.on('slotsLoaded', ({ foundSlots, savedSlots, clubName }) => {
      console.log(`${foundSlots} slots (${savedSlots} new) found at ${clubName}`)
    })

    const matchiClubs = config.endpoints.matchi.filter(x => x.include)
    matchiClubs.forEach(club => {
      const delay = { minDelay: settings.matchiMinDelay * matchiClubs.length, maxDelay: settings.matchiMaxDelay * matchiClubs.length }
      const matchiClient = new MatchiClient(club, delay)
      setTimeout(() => matchiClient.init(), Helper.randomIntFromInterval(settings.matchiMinDelay, settings.matchiMaxDelay))
      matchiClient.on('slotsLoaded', (res) => {
        console.log(`${res.foundSlots} slots (${res.savedSlots} new) found at ${club.name}`)
      })
    })

    const matchiPadelClubs = config.endpoints.matchiPadel.filter(x => x.include)
    matchiPadelClubs.forEach(club => {
      const delay = { minDelay: settings.matchiPadelMinDelay * matchiPadelClubs.length, maxDelay: settings.matchiPadelMaxDelay * matchiPadelClubs.length }
      const matchiPadelClient = new MatchiPadelClient(club, delay)
      setTimeout(() => matchiPadelClient.init(), Helper.randomIntFromInterval(settings.matchiPadelMinDelay, settings.matchiPadelMaxDelay))
      matchiPadelClient.on('slotsLoaded', (res) => {
        console.log(`${res.foundSlots} slots (${res.savedSlots} new) found at ${club.name}`)
      })
    })
  }
}
