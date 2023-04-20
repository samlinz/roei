#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const dotenv = require("dotenv");
const { exec } = require("child_process");
const {
  parseISO,
  formatISO,
  format,
  differenceInHours,
  differenceInMinutes,
  isSaturday,
} = require("date-fns");
const { log } = require("console");
dotenv.config();

const _getConfig = async (configFile) => {
  const f1 = await fs.readFile(configFile);
  const f = JSON.parse(f1);
  return (name) => {
    return f[name] || f[name.toLowerCase()];
  };
};

const getDirFullPath = (dir) => {
  const isAbsolute = dir.startsWith("/");
  if (isAbsolute) return dir;
  return `${__dirname}/${dir}`;
};

// Utility functions
const isTimeValid = (str) => {
  if (!str) return false;
  const [p1, p2] = str.split(":");
  const [n1, n2] = [Number(p1), Number(p2)];
  if (!Number.isNaN(n1) && !Number.isNaN(n2)) {
    return true;
  }
  return false;
};

const normalizeCategory = (str) => {
  return str.trim().toUpperCase();
};

const getCategory =
  ({ getConfig }) =>
  (str) => {
    const categories = getConfig("categories") || {};
    for (const cat of Object.keys(categories)) {
      const config = categories[cat];
      const aliases = config.alias || [];
      const categoryNormalized = normalizeCategory(cat);
      if (normalizeCategory(str) === categoryNormalized)
        return categoryNormalized;
      if (aliases.includes(str)) return categoryNormalized;
    }
    return null;
  };

const getFormattedDate = (date) => {
  //   return formatISO(date);
  return format(date, "yyyy-MM-dd HH:mm");
};

const getFullDateForTime = (time) => {
  const now = new Date();
  if (!time || !isTimeValid(time)) return getFormattedDate(now);
  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const dd = now.getDate();
  const [hh, min] = time.split(":");
  const full = new Date(yyyy, mm, dd, hh, min);
  return getFormattedDate(full);
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

const fileExists = async (file) => {
  try {
    await fs.access(file, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
};

const doBackup = async ({ file }) => {
  const backupDir = `${__dirname}/backups`;
  if (!(await fileExists(backupDir))) {
    fs.makeDirSync(backupDir);
  }
  const fileBaseName = path.basename(file);
  const backupFile = `${Date.now()}_${fileBaseName}`;
  await fs.copyFile(file, `${backupDir}/${backupFile}`);
  // console.log(`Backup created: ${backupFile}`);
};

const isRowLogRow = (row) => {
  if (!row) return false;
  if (row.trim().length === 0) return false;
  if (!row.includes(";")) return false;
  return true;
};

const handleList = async ({ file }) => {
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

  const now = new Date();
  const firstTimestampParsed = parseISO(firstTimestamp);
  const diff = differenceInMinutes(now, firstTimestampParsed);
  const diffHours = (diff / 60).toFixed(2);
  console.log(
    `Total hours today from ${firstTimestampParsed.getHours()}:${firstTimestampParsed
      .getMinutes()
      .toString()
      .padStart(2, "0")} to ${now.getHours()}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}: ${diffHours}`
  );
  console.log("Rows today:");
  console.log(result.join("\n"));
};

const writeRows = async ({ rows, file }) => {
  const data = rows.join("\n");
  await fs.writeFile(file, data);
};

const handleStatus = async ({ file }) => {
  console.log("Status");
};

const handleRemove = async ({ file }) => {
  await doBackup({ file });
  const rows = await getRows({ file });
  let lastRow = rows.pop();
  if (lastRow.startsWith("=")) {
    lastRow = rows.pop();
  }
  await writeRows({ rows, file });
  console.log(`REMOVED ${lastRow}`);
};

const getActivity = async (row) => {
  const { date, category, desc } = parseRow(row);
  const parts = desc.split(" ");
  const firstPart = parts[0];
  const rest = parts.slice(1).join(" ");
  if (firstPart === "START") {
    return rest;
  }
  return null;
};

const handleActivity =
  ({ getConfig }) =>
  async ({ file, isStart, isStop, params }) => {
    const rows = await getRows({ file });
    const lastRow = rows[rows.length - 1];
    const activityName = await getActivity(lastRow);
    const {
      date: lastDate,
      category: lastCategory,
      desc: lastDesc,
    } = parseRow(lastRow);

    const { category, desc, time } = isStart
      ? parseLogParams({ params, getConfig })
      : {};
    const fullDateForTime = isStart ? getFullDateForTime(time) : null;

    const startActivity = async (name) => {
      const row = getLogRow({
        category,
        time: fullDateForTime,
        desc,
        prefix: "START",
      });
      await appendRow({ file, row, time: fullDateForTime });
    };

    const stopActivity = async (name) => {
      const time = getFormattedDate(new Date());
      const descFixed = lastDesc.replace("START ", "");
      const row = getLogRow({
        category: lastCategory,
        desc: descFixed,
        prefix: "STOP",
        time,
      });
      await appendRow({ file, row, time });
    };

    if (activityName && isStart) {
      console.log(`Activity ${activityName} already started -> stopping`);
      await stopActivity(activityName);
    }

    if (!activityName && isStop) {
      console.log(`No activity running`);
    } else if (activityName && isStop) {
      console.log(`Stopping activity ${activityName}`);
      await stopActivity(activityName);
    } else if (!activityName && isStart && !desc) {
      console.log(`No activity name provided`);
    } else if (isStart && desc) {
      console.log(`Starting activity ${desc}`);
      await startActivity(desc);
    } else {
      console.error("fug :D");
    }
  };

const getLogRow = ({ category, date, time, desc, prefix, postfix }) => {
  const fullDesc = [prefix, desc || "-", postfix].filter((x) => x).join(" ");
  const fullRow = `${
    time || getFormattedDate(date)
  }; ${category.toUpperCase()}; ${fullDesc}`;
  return fullRow;
};

const handleOpen = async ({ file }) => {
  console.log(`Opening file: ${file}`);
  const cmd = [
    "'/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl'",
    file,
  ].join(" ");
  log(cmd);
  await exec(cmd);
};

const appendRow = async ({ file, row, time }) => {
  await doBackup({ file });

  const rows = await getRows({ file });
  const newRows = [...rows];
  const lastRow = rows.pop();
  const lastDate = parseRow(lastRow)?.date;
  const lastDateDate = lastDate ? parseISO(lastDate).getDate() : null;
  const isDateSame =
    lastDate !== null && lastDateDate === parseISO(time).getDate();

  if (!isDateSame) {
    const TIME_CHANGE_STR = "======";
    newRows.push(TIME_CHANGE_STR);
  }

  newRows.push(row);
  await writeRows({
    rows: newRows,
    file,
  });

  console.log(`-> ${row}`);
};

const parseLogParams = ({ getConfig, params }) => {
  const [cmd1, cmd2, cmd3, cmd4] = params;

  const isFirstCommandLog = ["log", "start", "stop"].includes(cmd1);
  const _category = isFirstCommandLog ? cmd2 : cmd1;
  const time = isFirstCommandLog ? cmd3 : cmd2;
  const timeValid = isTimeValid(time);
  const desc = isFirstCommandLog
    ? timeValid
      ? params.slice(3).join(" ")
      : params.slice(2).join(" ")
    : timeValid
    ? params.slice(2).join(" ")
    : params.slice(1).join(" ");

  // Validate category
  const category = getCategory({ getConfig })(_category);
  // console.log({
  //   _category,
  //   category,
  //   time,
  //   desc,
  //   params,
  // });
  if (!category) {
    console.error(`Invalid category: ${_category}`);
    process.exit(1);
  }

  return {
    category,
    desc,
    time,
  };
};

const handleAddLog =
  ({ getConfig }) =>
  async ({ file, params }) => {
    const { category, desc, time } = parseLogParams({ params, getConfig });
    const fullDateForTime = getFullDateForTime(time);

    // Create log row
    const fullRow = getLogRow({
      category,
      time: fullDateForTime,
      desc,
    });

    await appendRow({ file, row: fullRow, time: fullDateForTime });
  };

const run = async () => {
  const getConfig = await _getConfig(`${__dirname}/.config.json`);
  const FILE = getConfig("file");
  const filePathFull = getDirFullPath(FILE);

  // Create file if doesn't exists
  if (!fileExists(filePathFull)) {
    fs.openSync(filePathFull, "w");
    console.log(`File created: ${filePathFull}`);
  }

  // Command line args
  const args = [...process.argv];
  const params = args.slice(2);
  const [cmd1, cmd2, cmd3, cmd4] = params;

  const ctx = {
    file: filePathFull,
    params,
  };

  if (!cmd1) {
    // console.log("No command provided");
    // process.exit(1);
    return await handleStatus(ctx);
  }

  const isCommandList = cmd1 === "list";
  const isCommandRemove = cmd1 === "rm";
  const isCommandOpen = cmd1 === "open";
  const isCommandStart = cmd1 === "start";
  const isCommandStop = cmd1 === "stop";
  //   const isCommandLog = !isCommandList;

  if (isCommandList) {
    await handleList(ctx);
  } else if (isCommandRemove) {
    await handleRemove(ctx);
  } else if (isCommandOpen) {
    await handleOpen(ctx);
  } else if (isCommandStart || isCommandStop) {
    await handleActivity({ getConfig })({
      ...ctx,
      isStart: isCommandStart,
      isStop: isCommandStop,
    });
  } else {
    // Default is add new log
    await handleAddLog({
      getConfig,
    })(ctx);
  }
};

run()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
