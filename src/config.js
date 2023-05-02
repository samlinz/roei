const fs = require("fs").promises;
const dotenv = require("dotenv");

const getConfig = async (configFile) => {
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

const initEnvironment = () => {
  dotenv.config();
};

module.exports = {
  getConfig,
  getDirFullPath,
  initEnvironment,
};
