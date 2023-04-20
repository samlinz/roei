const { exec } = require("child_process");
const { parseISO, differenceInMinutes } = require("date-fns");
const { getFullDateForTime, getFormattedDate } = require("./string");
const {
  appendRow,
  doBackup,
  getActivity,
  getLogRow,
  getRows,
  isRowLogRow,
  parseLogParams,
  parseRow,
  writeRows,
} = require("./util");
const {
  STR_ACTIVITY_START,
  STR_ACTIVITY_STOP,
  CHAR_SEPARATOR,
} = require("./constants");

const buildHandlers = ({ getConfig, file, params, log }) => {
  const handleStatus = async () => {
    log.info("Status");
  };

  const handleList = async () => {
    const rows = await getRows({ file });
    const result = [];
    const currentDate = new Date().getDate();

    let firstTimestamp = null;

    for (const row of rows) {
      if (!isRowLogRow(row)) continue;
      const parsed = parseRow(row);
      if (!parsed) continue;
      if (parseISO(parsed.date).getDate() !== currentDate) continue;
      if (!firstTimestamp) {
        firstTimestamp = parsed.date;
      }
      result.push(row);
    }

    const formatDigits = (n) => n.toString().padStart(2, "0");

    const now = new Date();
    const firstTimestampParsed = parseISO(firstTimestamp);

    const diff = differenceInMinutes(now, firstTimestampParsed);
    const diffHours = (diff / 60).toFixed(2);

    const timeStartString = `${formatDigits(
      firstTimestampParsed.getHours()
    )}:${formatDigits(firstTimestampParsed.getMinutes())}`;

    const timeStopString = `${formatDigits(now.getHours())}:${formatDigits(
      now.getMinutes()
    )}`;

    log.info(
      `Total hours today from ${timeStartString} to ${timeStopString}: ${diffHours}`
    );

    log.info("Rows today:");
    log.info(result.join("\n"));
  };

  const handleRemove = async () => {
    await doBackup({ file });
    const rows = await getRows({ file });
    let lastRow = rows.pop();
    if (lastRow.startsWith(CHAR_SEPARATOR)) {
      lastRow = rows.pop();
    }
    await writeRows({ rows, file });
    log.info(`REMOVED ${lastRow}`);
  };

  const handleActivity = async ({ isStart, isStop }) => {
    const rows = await getRows({ file });
    const lastRow = rows[rows.length - 1];
    const activityName = await getActivity(lastRow);
    const {
      //   date: lastDate,
      category: lastCategory,
      desc: lastDesc,
    } = parseRow(lastRow);

    const parsed = isStart ? parseLogParams({ params, getConfig }) : {};
    if (parsed instanceof Error) {
      log.error(parsed.message);
      process.exit(1);
    }

    const { category, desc, time } = parsed;

    const fullDateForTime = isStart ? getFullDateForTime(time) : null;

    const startActivity = async () => {
      const row = getLogRow({
        category,
        time: fullDateForTime,
        desc,
        prefix: STR_ACTIVITY_START,
      });
      await appendRow({ file, row, time: fullDateForTime, log });
    };

    const stopActivity = async () => {
      const time = getFormattedDate(new Date());
      const descFixed = lastDesc.replace(STR_ACTIVITY_START, "");
      const row = getLogRow({
        category: lastCategory,
        desc: descFixed,
        prefix: STR_ACTIVITY_STOP,
        time,
      });
      await appendRow({ file, row, time, log });
    };

    if (activityName && isStart) {
      log.info(`Activity ${activityName} already started -> stopping`);
      await stopActivity(activityName);
    }

    if (!activityName && isStop) {
      log.info(`No activity running`);
    } else if (activityName && isStop) {
      log.info(`Stopping activity ${activityName}`);
      await stopActivity(activityName);
    } else if (!activityName && isStart && !desc) {
      log.info(`No activity name provided`);
    } else if (isStart && desc) {
      log.info(`Starting activity ${desc}`);
      await startActivity(desc);
    }
  };

  const handleOpen = async () => {
    log.info(`Opening file: ${file}`);
    const cmd = [
      "'/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl'",
      file,
    ].join(" ");
    log.info(cmd);
    await exec(cmd);
  };

  const handleAddLog = async () => {
    const parsed = parseLogParams({ params, getConfig });
    if (parsed instanceof Error) {
      log.error(parsed.message);
      process.exit(1);
    }

    const { category, desc, time } = parsed;

    const fullDateForTime = getFullDateForTime(time);

    // Create log row
    const fullRow = getLogRow({
      category,
      time: fullDateForTime,
      desc,
    });

    await appendRow({ file, row: fullRow, time: fullDateForTime, log });
  };

  return {
    handleAddLog,
    handleActivity,
    handleStatus,
    handleList,
    handleRemove,
    handleOpen,
  };
};

module.exports = {
  buildHandlers,
};
