#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { parseISO, formatISO, format } = require("date-fns");
const { log } = require("console");
dotenv.config();

const _getConfig = (configFile) => {
  const f1 = fs.readFileSync(configFile);
  const f = JSON.parse(f1);
  return (name) => {
    return f[name] || f[name.toLowerCase()];
  };
};
const getConfig = _getConfig(`${__dirname}/.config.json`);

const getDirFullPath = (dir) => {
  const isAbsolute = dir.startsWith("/");
  if (isAbsolute) return dir;
  return `${__dirname}/${dir}`;
};

const FILE = getConfig("file");
const filePathFull = getDirFullPath(FILE);

// Create file if doesn't exists
if (!fs.existsSync(filePathFull)) {
  fs.openSync(filePathFull, "w");
  console.log(`File created: ${filePathFull}`);
}

// Command line args
const args = [...process.argv];
const params = args.slice(2);
const [cmd1, cmd2, cmd3, cmd4] = params;
const isCommandList = cmd1 === "list";
const isCommandLog = !isCommandList;

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

const getCategory = (str) => {
  const categories = getConfig("categories") || {};
  const alias = getConfig("alias") || {};
  for (const cat of Object.keys(categories)) {
    // const aliases = alias[cat] || [];
    const config = categories[cat];
    const aliases = config.alias || [];
    // console.log({
    //   cat,
    //   categories,
    //   alias,
    //   aliases,
    //   str,
    //   asdfafs: normalizeCategory(str),
    // });
    const categoryNormalized = normalizeCategory(cat);
    if (normalizeCategory(str) === categoryNormalized)
      return categoryNormalized;
    if (aliases.includes(str)) return categoryNormalized;
  }
  return null;
};

const getFormattedDate = (date) => {
  //   return formatISO(date);
  return format(date, "yyyy-MM-dd HH:MM");
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
    category: s[1].toUpperCase(),
    desc: s[2].trim(),
  };
};

if (isCommandList) {
  console.log("list");
} else if (isCommandLog) {
  const isFirstCommandLog = cmd1 === "log";
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
  const category = getCategory(_category);
  if (!category) {
    console.error(`Invalid category: ${_category}`);
    process.exit(1);
  }

  // Create log row
  const getFullDate = getFullDateForTime(time);
  const fullRow = `${getFullDate}; ${category.toUpperCase()}; ${desc || "-"}`;

  {
    const backupDir = `${__dirname}/backups`;
    if (!fs.existsSync(backupDir)) {
      fs.makeDirSync(backupDir);
    }
    const fileBaseName = path.basename(FILE);
    const backupFile = `${Date.now()}_${fileBaseName}`;
    fs.copyFileSync(filePathFull, `${backupDir}/${backupFile}`);
    // console.log(`Backup created: ${backupFile}`);
  }

  {
    const oldRows = fs.readFileSync(filePathFull, "utf-8");
    const splitRows = oldRows.length === 0 ? [] : oldRows.split("\n");
    const newRows = [...splitRows];
    const lastRow = splitRows.pop();
    const lastDate = parseRow(lastRow)?.date;
    const lastDateDate = lastDate ? parseISO(lastDate).getDate() : null;
    const isDateSame =
      lastDate !== null && lastDateDate === parseISO(getFullDate).getDate();
    if (!isDateSame) {
      const TIME_CHANGE_STR = "======";
      newRows.push(TIME_CHANGE_STR);
    }
    newRows.push(fullRow);
    fs.writeFileSync(filePathFull, newRows.join("\n"));

    console.log(`-> ${fullRow}`);
  }
}
