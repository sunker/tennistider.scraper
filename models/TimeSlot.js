const _startTime = Symbol('startTime')
const _active = Symbol('active')
const _endTime = Symbol('endTime')
module.exports = class TimeSlot {
  constructor(startTime, endTime, active) {
    if (!endTime) {
      endTime = startTime + 1
    }

    if (startTime >= endTime) {
      throw Error('Invalid endtime')
    }
    this[_startTime] = startTime
    this[_endTime] = endTime
    if (active === undefined) active = true
    this[_active] = active
  }

  get startTime() {
    return this[_startTime]
  }

  get endTime() {
    return this[_endTime]
  }

  get active() {
    return this[_active]
  }

  toJSON() {
    return {
      startTime: this[_startTime],
      endTime: this[_endTime],
      active: this[_active]
    }
  }

  toString() {
    return this[_startTime].toFixed(2).toString() + '-' + this[_endTime].toFixed(2).toString()
  }
}
