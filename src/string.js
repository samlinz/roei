const { format } = require("date-fns");
const { isTimeValid } = require("./validate");

const normalizeCategory = (str) => {
  return str.trim().toUpperCase();
};

const getFormattedDate = (date) => {
  return format(date, "yyyy-MM-dd HH:mm");
};

const parseTimeString = (time) => {
  const [hour, min] = time.split(":");
  const hourInt = parseInt(hour, 10);
  const minInt = parseInt(min, 10);
  if (isNaN(hourInt) || isNaN(minInt)) return Error("Invalid time");
  return {
    hour: hourInt,
    min: minInt,
  };
};

const getFullDateForTime = (time) => {
  const now = new Date();

  if (!time || !isTimeValid(time)) {
    return getFormattedDate(now);
  }

  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const dd = now.getDate();
  const { hour, min } = parseTimeString(time);
  const full = new Date(yyyy, mm, dd, hour, min);
  return getFormattedDate(full);
};

module.exports = {
  getFormattedDate,
  getFullDateForTime,
  normalizeCategory,
  parseTimeString,
};
