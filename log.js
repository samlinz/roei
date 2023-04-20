/* eslint-disable no-console */
const { noop } = require("./util");

const getLogger = ({ showPrefix, isDisabled }) => {
  if (isDisabled) {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    };
  }

  const getPrefix = (category) => (showPrefix ? `[${category}]` : "");
  const debug = (...args) => console.log(getPrefix("DEBUG"), ...args);
  const info = (...args) => console.log(getPrefix("INFO"), ...args);
  const warn = (...args) => console.log(getPrefix("WARN"), ...args);
  const error = (...args) => console.log(getPrefix("ERROR"), ...args);

  return {
    debug,
    error,
    info,
    warn,
  };
};

module.exports = {
  getLogger,
};
