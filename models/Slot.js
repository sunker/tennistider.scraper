const TimeSlot = require('./TimeSlot')

module.exports = class Slot {
  constructor(clubId, clubName, date, timeSlot, courtNumber, surface, price, link) {
    this.clubId = clubId
    this.clubName = clubName
    this.timeSlot = timeSlot
    this._date = date
    this.price = price
    this.courtNumber = courtNumber
    this.surface = surface
    this.link = link
  }

  get date() {
    return new Date(this._date)
  }

  toSwedishDay() {
    switch (this.date.getDay()) {
      case 1:
        return 'måndag'
      case 2:
        return 'tisdag'
      case 3:
        return 'onsdag'
      case 4:
        return 'torsdag'
      case 5:
        return 'fredag'
      case 6:
        return 'lördag'
      case 0:
        return 'söndag'
      default:
        return ''
    }
  }

  get isOnWeekend() {
    return (this.date.getDay() === 6) || (this.date.getDay() === 0)
  }

  get isMorningSlot() {
    return (!this.isOnWeekend && this.timeSlot.startTime >= 7 && this.timeSlot.endTime <= 9)
  }

  get isLunchtimeSlot() {
    return (!this.isOnWeekend && this.timeSlot.startTime >= 11 && this.timeSlot.endTime <= 13)
  }

  get isWeekdayNightSlot() {
    return (!this.isOnWeekend && this.timeSlot.startTime >= 17)
  }

  daysFromToday() {
    const ONE_DAY = 1000 * 60 * 60 * 24
    const date1_ms = new Date().getTime()
    const date2_ms = this.date.getTime()
    const difference_ms = Math.abs(date1_ms - date2_ms)

    return Math.round(difference_ms / ONE_DAY)
  }

  get slotKey() {
    return this.date.getFullYear() + '_' + (this.date.getMonth() + 1) + '_' + this.date.getDate() + '_' + this.clubId + '_' + this.timeSlot.toString() + '_' + (this.surface ? this.surface : 'uknownsurface') + '_' + this.courtNumber
  }

  getKey(userId) {
    return userId + '_' + this.slotKey
  }

  stringify() {
    return {
      clubId: this.clubId,
      clubName: this.clubName,
      price: this.price,
      date: this._date,
      courtNumber: this.courtNumber,
      surface: this.surface,
      timeSlot: this.timeSlot.startTime.toFixed(2).toString() + '-' + this.timeSlot.endTime.toFixed(2).toString()
    }
  }

  toString() {
    return this.toSwedishDay() + ' ' + this.date.getDate() + '/' + (this.date.getMonth() + 1) + ' kl ' + this.timeSlot.toString() + ' ' + (this.surface ? this.surface : '')
  }
}
