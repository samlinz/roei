#!/usr/bin/env node

const fs = require("fs/promises");
const { getLogger } = require("./log");
const { fileExists } = require("./util");
const { getConfig: _getConfig, getDirFullPath } = require("./config");
const { buildHandlers } = require("./commands");
const {
  CMD_LIST,
  CMD_REMOVE_LAST,
  CMD_OPEN_EDITOR,
  CMD_START_ACTIVITY,
  CMD_STOP_ACTIVITY,
  CMD_PAUSE,
} = require("./constants");

const run = async () => {
  const getConfig = await _getConfig(`${__dirname}/.config.json`);
  const FILE = getConfig("file");
  const filePathFull = getDirFullPath(FILE);

  const log = getLogger({
    showPrefix: true,
  });

  if (!fileExists(filePathFull)) {
    fs.openSync(filePathFull, "w");
    log.info(`File created: ${filePathFull}`);
  }

  const args = [...process.argv];
  const params = args.slice(2);
  const [cmd1] = params;

  const handlers = buildHandlers({
    getConfig,
    file: filePathFull,
    params,
    log,
  });

  if (!cmd1) {
    return await handlers.handleStatus();
  }

  const isCommandList = cmd1 === CMD_LIST;
  const isCommandRemove = cmd1 === CMD_REMOVE_LAST;
  const isCommandOpen = cmd1 === CMD_OPEN_EDITOR;
  const isCommandStart = cmd1 === CMD_START_ACTIVITY;
  const isCommandStop = cmd1 === CMD_STOP_ACTIVITY;
  const isCommandPause = cmd1 === CMD_PAUSE;

  if (isCommandList) {
    await handlers.handleList();
  } else if (isCommandRemove) {
    await handlers.handleRemove();
  } else if (isCommandOpen) {
    await handlers.handleOpen({
      openFileCommand: getConfig("openFileCommand"),
    });
  } else if (isCommandPause) {
    await handlers.handlePause();
  } else if (isCommandStart || isCommandStop) {
    await handlers.handleActivity({
      isStart: isCommandStart,
      isStop: isCommandStop,
    });
  } else {
    // Default is add new log
    await handlers.handleAddLog();
  }
};

run()
  .then(() => {})
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
