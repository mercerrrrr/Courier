require('dotenv').config();

function toNumber(value, defaultValue) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

module.exports = {
  BREAK_AFTER_HOURS: toNumber(process.env.BREAK_AFTER_HOURS, 4),
  BREAK_DURATION_MINUTES: toNumber(process.env.BREAK_DURATION_MINUTES, 30),
  MAX_SHIFT_HOURS: toNumber(process.env.MAX_SHIFT_HOURS, 9),
  HARD_REST_HOURS_AFTER_BLOCK: toNumber(process.env.HARD_REST_HOURS_AFTER_BLOCK, 6),
  MIN_REST_BETWEEN_SHIFTS_HOURS: toNumber(process.env.MIN_REST_BETWEEN_SHIFTS_HOURS, 1),
  MIN_SHIFT_HOURS_BEFORE_CAN_END: toNumber(process.env.MIN_SHIFT_HOURS_BEFORE_CAN_END, 3),
  TIME_ACCELERATION_FACTOR: toNumber(process.env.TIME_ACCELERATION_FACTOR, 60)
};
