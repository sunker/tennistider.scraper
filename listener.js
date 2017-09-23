const HellasClient = require('./scrapers/HellasClient')
const config = require('./config.json')

module.exports = {
  init() {
    const hellasClient = new HellasClient()
    if (config.endpoints.hellas.include) {
      hellasClient.init()
    }

    hellasClient.on('slotsLoaded', (slots) => {
      console.log(`${slots.length} slots found at Hellas TK`)
    })
  }
}
