const fs = require("fs").promises;
const path = require("path");
const { normalizeCategory, getFormattedDate } = require("./string");
const {
  CHAR_SEPARATOR,
  STR_EMPTY_DESCRIPTION,
  STR_ACTIVITY_START,
  STR_ACTIVITY_PAUSE_START,
  ENABLED_COMMANDS,
  STR_EMPTY_CATEGORY,
  STR_ACTIVITY_PAUSE_STOP,
} = require("./constants");
const { parseISO, differenceInMinutes } = require("date-fns");
const { isTimeValid } = require("./validate");

const getCategory =
  ({ getConfig }) =>
  (str) => {
    if (!str) return null;
    const categories = getConfig("categories") || {};
    for (const cat of Object.keys(categories)) {
      if (!cat) continue;
      const config = categories[cat];
      const aliases = config.alias || [];
      const categoryNormalized = normalizeCategory(cat);
      if (normalizeCategory(str) === categoryNormalized)
        return categoryNormalized;
      if (aliases.includes(str)) return categoryNormalized;
    }
    return null;
  };

const parseRow = (row) => {
  if (!row || row.trim().length === 0) return null;
  const s = row.split(";");
  return {
    date: s[0].trim(),
    category: s[1].trim().toUpperCase(),
    desc: s[2].trim(),
  };
};

const getRows = async ({ file }) => {
  const oldRows = await fs.readFile(file, "utf-8");
  const splitRows = oldRows.length === 0 ? [] : oldRows.split("\n");
  const newRows = [...splitRows];
  return newRows;
};

const getLastRow = async ({ file }) => {
  const rows = await getRows({ file });
  const rowsCopy = [...rows];
  while (rowsCopy.length > 0) {
    const row = rowsCopy.pop();
    if (isRowLogRow(row)) {
      return row;
    }
  }
  return null;
};

const fileExists = async (file) => {
  try {
    await fs.access(file, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
};

const writeRows = async ({ rows, file }) => {
  const data = rows.join("\n");
  await fs.writeFile(file, data);
};

const isRowLogRow = (row) => {
  if (!row) return false;
  if (row.trim().length === 0) return false;
  if (!row.includes(";")) return false;
  return true;
};

const getDescriptionFirstPart = (desc) => {
  const parts = desc.split(" ");
  const firstPart = parts[0];
  const rest = parts.slice(1).join(" ");
  return [firstPart, rest];
};

const getPauseDesc = (row) => {
  const desc = parseRow(row).desc;
  const [firstPart, rest] = getDescriptionFirstPart(desc);
  if (firstPart === STR_ACTIVITY_PAUSE_START) {
    return rest;
  }
  return null;
};

const isPauseStart = (row) => {
  const desc = parseRow(row).desc;
  const [firstPart] = getDescriptionFirstPart(desc);
  return firstPart === STR_ACTIVITY_PAUSE_START;
};

const isPauseStop = (row) => {
  const desc = parseRow(row).desc;
  const [firstPart] = getDescriptionFirstPart(desc);
  return firstPart === STR_ACTIVITY_PAUSE_STOP;
};

const getActivity = (row) => {
  const { desc } = parseRow(row);
  const parts = desc.split(" ");
  const firstPart = parts[0];
  const rest = parts.slice(1).join(" ");
  if (firstPart === STR_ACTIVITY_START) {
    return rest;
  }
  return null;
};

const parseLogParams = ({ getConfig, params, isCategoryRequired }) => {
  const [cmd1, cmd2, cmd3] = params;

  const isFirstParameterCommand = ENABLED_COMMANDS.includes(cmd1);
  const _category = isFirstParameterCommand ? cmd2 : cmd1;
  const time = isFirstParameterCommand ? cmd3 : cmd2;
  const timeValid = isTimeValid(time);

  const desc = isFirstParameterCommand
    ? timeValid
      ? params.slice(3).join(" ")
      : params.slice(2).join(" ")
    : timeValid
    ? params.slice(2).join(" ")
    : params.slice(1).join(" ");

  const defaultCategory = getConfig("defaultCategory");
  const category = getCategory({ getConfig })(_category);
  if (!category) {
    if (isCategoryRequired === false) {
      return {
        category: defaultCategory || STR_EMPTY_CATEGORY,
        desc: STR_EMPTY_DESCRIPTION,
        time: null,
      };
    }
    return Error(`Invalid category: ${_category}`);
  }

  return {
    category,
    desc,
    time,
  };
};

const appendRow = async ({ file, row, time, log }) => {
  await doBackup({ file });

  const rows = await getRows({ file });
  const newRows = [...rows];
  const lastRow = rows.pop();
  const lastDate = parseRow(lastRow)?.date;
  const lastDateDate = lastDate ? parseISO(lastDate).getDate() : null;
  const isDateSame =
    lastDate !== null && lastDateDate === parseISO(time).getDate();

  if (!isDateSame) {
    const TIME_CHANGE_STR = CHAR_SEPARATOR.repeat(5);
    newRows.push(TIME_CHANGE_STR);
  }

  newRows.push(row);
  await writeRows({
    rows: newRows,
    file,
  });

  log.info(`-> ${row}`);
};

const noop = () => {};

const getLogRow = ({ category, date, time, desc, prefix, postfix }) => {
  const fullDesc = [prefix, desc || STR_EMPTY_DESCRIPTION, postfix]
    .filter((x) => x)
    .join(" ");

  const fullRow = `${
    time || getFormattedDate(date)
  }; ${category.toUpperCase()}; ${fullDesc}`;

  return fullRow;
};

const doBackup = async ({ file }) => {
  const backupDir = path.join(__dirname, "..", "backups");

  if (!(await fileExists(backupDir))) {
    await fs.mkdir(backupDir);
  }

  const fileBaseName = path.basename(file);
  const backupFile = `${Date.now()}_${fileBaseName}`;
  await fs.copyFile(file, `${backupDir}/${backupFile}`);
  // console.log(`Backup created: ${backupFile}`);
};

const getDateStatistics = ({ rows, date, lunchMinutes }) => {
  if (!rows || rows.length === 0) {
    return {
      hoursUntilNow: 0,
      hoursUntilLastEntry: 0,
    };
  }

  let firstTimestamp = null;
  let lastTimestamp = null;

  const now = new Date();

  const dateRows = [];

  let pauseStart = null;
  let pausedMinutesTotal = 0;

  const updatePausedMinutes = (stop) => {
    const parsedStopDate = parseISO(stop);
    const pausedMinutes = differenceInMinutes(parsedStopDate, pauseStart) || 0;
    pausedMinutesTotal += pausedMinutes;
    pauseStart = null;
  };

  for (const row of rows) {
    if (!isRowLogRow(row)) continue;
    const parsed = parseRow(row);
    if (!parsed) continue;
    if (parseISO(parsed.date).getDate() !== date) continue;
    if (!firstTimestamp) {
      firstTimestamp = parsed.date;
    }
    if (isPauseStart(row)) {
      pauseStart = parseISO(parsed.date);
    } else if (isPauseStop(row)) {
      updatePausedMinutes(parsed.date);
    } else {
      lastTimestamp = parsed.date;
    }
    dateRows.push(row);
  }

  if (pauseStart) {
    // Pause was started but not stopped
    updatePausedMinutes(now);
  }

  const formatDigits = (n) => n.toString().padStart(2, "0");

  const firstTimestampParsed = parseISO(firstTimestamp);
  const lastTimestampParsed = parseISO(lastTimestamp);

  const d1 = differenceInMinutes(now, firstTimestampParsed);
  const d2 = d1 - lunchMinutes;
  const d2WithPause = d2 - pausedMinutesTotal;
  const diffHours1 = (d2 / 60).toFixed(2);
  const diffHours1WithPauses = (d2WithPause / 60).toFixed(2);

  const d3 = differenceInMinutes(lastTimestampParsed, firstTimestampParsed);
  const d4 = d3 - lunchMinutes;
  const d4WithPause = d4 - pausedMinutesTotal;
  const diffHours2 = (d4 / 60).toFixed(2);
  const diffHours2WithPauses = (d4WithPause / 60).toFixed(2);

  const pausedHours = (pausedMinutesTotal / 60).toFixed(2);

  const timeStartString = `${formatDigits(
    firstTimestampParsed.getHours()
  )}:${formatDigits(firstTimestampParsed.getMinutes())}`;

  const timeUntilNowStopString = `${formatDigits(
    now.getHours()
  )}:${formatDigits(now.getMinutes())}`;

  const timeUntilLastEntryStopString = `${formatDigits(
    lastTimestampParsed.getHours()
  )}:${formatDigits(lastTimestampParsed.getMinutes())}`;

  return {
    hoursUntilNow: diffHours1,
    hoursUntilNowWithPauses: diffHours1WithPauses,
    hoursUntilLastEntry: diffHours2,
    hoursUntilLastEntryWithPauses: diffHours2WithPauses,
    timeStartString,
    timeUntilNowStopString,
    timeUntilLastEntryStopString,
    dateRows,
    pausedHours,
  };
};

module.exports = {
  appendRow,
  doBackup,
  fileExists,
  getActivity,
  getCategory,
  getDateStatistics,
  getLastRow,
  getLogRow,
  getPauseDesc,
  getRows,
  isRowLogRow,
  isTimeValid,
  noop,
  parseLogParams,
  parseRow,
  writeRows,
};
