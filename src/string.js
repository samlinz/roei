const { format } = require("date-fns");
const { isTimeValid } = require("./validate");

const normalizeCategory = (str) => {
  return str.trim().toUpperCase();
};

const getFormattedDate = (date) => {
  return format(date, "yyyy-MM-dd HH:mm");
};

const getFullDateForTime = (time) => {
  const now = new Date();

  if (!time || !isTimeValid(time)) {
    return getFormattedDate(now);
  }

  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const dd = now.getDate();
  const [hh, min] = time.split(":");
  const full = new Date(yyyy, mm, dd, hh, min);
  return getFormattedDate(full);
};

module.exports = {
  getFormattedDate,
  normalizeCategory,
  getFullDateForTime,
};
