const { exec } = require("child_process");
const {
  getFullDateForTime,
  getFormattedDate,
  normalizeString,
  getWord,
  isEmptyDescription,
} = require("./string");
const {
  appendRow,
  doBackup,
  getActivity,
  getLogRow,
  getRows,
  parseLogParams,
  parseRow,
  writeRows,
  getLastRow,
  getPauseDesc,
  getDateStatistics,
  parseTimeSpan,
  getTotalMinutes,
  parseDate,
} = require("./util");
const {
  STR_ACTIVITY_START,
  STR_ACTIVITY_STOP,
  CHAR_SEPARATOR,
  STR_ACTIVITY_PAUSE_START,
  STR_ACTIVITY_PAUSE_STOP,
  STR_ACTIVITY_PAUSE_SINGLE,
} = require("./constants");
const { getDate, getHours, getMinutes } = require("date-fns");

const getFullStatus = async ({ file, getConfig, now }) => {
  const rows = await getRows({ file });
  const lunchMinutes = getConfig("removeLunchMinutes") || 0;
  return getDateStatistics({
    lunchMinutes,
    rows,
    now,
  });
};

const buildGetParsedParams =
  ({ params, getConfig, log }) =>
  (extraArgs = {}) => {
    const parsed = parseLogParams({
      params,
      getConfig,
      ...extraArgs,
    });

    if (parsed instanceof Error) {
      log.error(parsed.message);
      throw parsed;
    }

    return parsed;
  };

const buildHandlers = ({ getConfig, file, params, log }) => {
  const getParsedParams = buildGetParsedParams({ params, getConfig, log });

  const handleStatus = async () => {
    const {
      hoursUntilLastEntryWithPauses,
      hoursUntilNowWithPauses,
      pausedHours,
    } = await getFullStatus({
      file,
      getConfig,
      now: new Date(),
    });

    log.info(
      `Today's hours so far: until last entry ${hoursUntilLastEntryWithPauses}, until now ${hoursUntilNowWithPauses}, pauses ${pausedHours}hrs`
    );
  };

  const handleList = async () => {
    const desc = params?.[1] || "";

    const defaultReferenceDate = new Date();

    let referenceDate = defaultReferenceDate;
    let showRelativeToNow = true;

    if (!isEmptyDescription(desc)) {
      const firstArg = getWord(normalizeString(desc), 0);
      const date = parseDate(firstArg);
      const hasTimeComponent = getHours(date) > 0 || getMinutes(date) > 0;

      referenceDate = date || referenceDate;

      log.info(
        `Evaluating in reference to date ${getFormattedDate(referenceDate)}`
      );

      if (
        getDate(referenceDate) !== getDate(defaultReferenceDate) &&
        !hasTimeComponent
      ) {
        showRelativeToNow = false;
      }
    }

    const lunchMinutes = getConfig("removeLunchMinutes") || 0;
    const isLunchEnabled = lunchMinutes > 0;

    const {
      hoursUntilNow,
      timeStartString,
      timeUntilLastEntryStopString,
      timeUntilNowStopString,
      dateRows,
      hoursUntilLastEntryWithPauses,
      hoursUntilNowWithPauses,
      pausedHours,
    } = await getFullStatus({
      file,
      getConfig,
      now: referenceDate,
    });

    if (showRelativeToNow) {
      log.info(
        `Hours from ${timeStartString} to ${timeUntilNowStopString}: ${hoursUntilNowWithPauses} (current time)`
      );
    }

    log.info(
      `Hours from ${timeStartString} to ${timeUntilLastEntryStopString}: ${hoursUntilLastEntryWithPauses} (last entry)`
    );

    if (isLunchEnabled) {
      log.info(`Lunch time: ${lunchMinutes} minutes taken into account`);
    }

    if (pausedHours > 0) {
      log.info(
        `Paused time: ${pausedHours} hours taken into account${
          showRelativeToNow ? ` (${hoursUntilNow} until now w/o pauses)` : ""
        }`
      );
    }

    log.info("Rows today:");
    log.raw(dateRows.join("\n"));
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

  const handlePauseSingle = async () => {
    const { category, desc, time } = getParsedParams({
      isDescriptionRequired: true,
    });

    const fullDateForTime = getFullDateForTime(time);
    const firstDescriptionWord = desc.split(" ")[0];
    const parseTimeToHours = parseTimeSpan(firstDescriptionWord);
    if (parseTimeToHours instanceof Error) throw parseTimeToHours;

    const totalHours = getTotalMinutes(parseTimeToHours);
    const remainingDesc = desc.replace(firstDescriptionWord, "").trim();

    const row = getLogRow({
      category,
      time: fullDateForTime,
      desc: remainingDesc,
      prefix: `${STR_ACTIVITY_PAUSE_SINGLE} ${totalHours}min`,
    });

    await appendRow({ file, row, time: fullDateForTime, log });
  };

  const handlePause = async () => {
    const parsed = getParsedParams({ isCategoryRequired: false });

    const { category, desc, time } = parsed;
    const lastRow = await getLastRow({ file });
    const activityName = getPauseDesc(lastRow);
    const fullDateForTime = getFullDateForTime(time);
    const isAlreadyPaused = !!activityName;

    let row = null;
    if (isAlreadyPaused) {
      row = getLogRow({
        category,
        time: fullDateForTime,
        desc: activityName,
        prefix: STR_ACTIVITY_PAUSE_STOP,
      });
    } else {
      row = getLogRow({
        category,
        time: fullDateForTime,
        desc: desc,
        prefix: STR_ACTIVITY_PAUSE_START,
      });
    }
    await appendRow({ file, row, time: fullDateForTime, log });
  };

  const handleActivity = async ({ isStart, isStop }) => {
    const rows = await getRows({ file });
    const lastRow = rows[rows.length - 1];
    const activityName = getActivity(lastRow);
    const {
      //   date: lastDate,
      category: lastCategory,
      desc: lastDesc,
    } = parseRow(lastRow);

    const parsed = isStart ? parseLogParams({ params, getConfig }) : {};
    if (parsed instanceof Error) {
      log.error(parsed.message);
      throw parsed;
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

  const handleOpen = async ({ openFileCommand, overrideFile }) => {
    const fileToOpen = overrideFile || file;

    if (!openFileCommand) {
      log.error("No open command provided in config");
      return;
    }

    log.info(`Opening file: ${fileToOpen}`);
    const cmd = [openFileCommand, fileToOpen].join(" ");
    log.info(cmd);

    await exec(cmd);
  };

  const handleAddLog = async () => {
    const { category, desc, time } = getParsedParams();
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
    handleActivity,
    handleAddLog,
    handleList,
    handleOpen,
    handlePause,
    handlePauseSingle,
    handleRemove,
    handleStatus,
  };
};

module.exports = {
  buildHandlers,
};
