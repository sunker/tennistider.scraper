const HellasClient = require('./scrapers/HellasClient')
const MatchiClient = require('./scrapers/MatchiClient')
const MatchiPadelClient = require('./scrapers/MatchiPadelClient')
const config = require('./config.json')
const settings = require('./settings')
const Helper = require('./scrapers/helper')

module.exports = {
  init() {
    const hellasClient = new HellasClient()
    if (config.endpoints.hellas.include) {
      hellasClient.init()
    }

    hellasClient.on('slotsLoaded', (slots) => {
      console.log(`${slots.length} slots found at Hellas TK`)
    })

    const matchiClubs = config.endpoints.matchi.filter(x => x.include)
    matchiClubs.forEach(club => {
      const delay = { minDelay: settings.matchiMinDelay * matchiClubs.length, maxDelay: settings.matchiMaxDelay * matchiClubs.length }
      const matchiClient = new MatchiClient(club, delay)
      setTimeout(() => matchiClient.init(), Helper.randomIntFromInterval(settings.matchiMinDelay, settings.matchiMaxDelay))
      matchiClient.on('slotsLoaded', ({ slots, club }) => {
        console.log(`${slots.length} slots found at ${club.name}`)
      })
    })

    const matchiPadelClubs = config.endpoints.matchiPadel.filter(x => x.include)
    matchiPadelClubs.forEach(club => {
      const delay = { minDelay: settings.matchiPadelMinDelay * matchiPadelClubs.length, maxDelay: settings.matchiPadelMaxDelay * matchiPadelClubs.length }
      const matchiPadelClient = new MatchiPadelClient(club, delay)
      setTimeout(() => matchiPadelClient.init(), Helper.randomIntFromInterval(settings.matchiPadelMinDelay, settings.matchiPadelMaxDelay))
      matchiPadelClient.on('slotsLoaded', ({ slots, club }) => {
        console.log(`${slots.length} slots found at ${club.name}`)
      })
    })
  }
}
