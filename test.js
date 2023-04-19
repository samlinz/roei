const { exec } = require("child_process");
const { log } = require("console");

const x = "'/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl'";
exec(x, (err, stdout, stderr) => {
  log(err);
  log(stdout);
  log(stderr);
});
