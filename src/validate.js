const isTimeValid = (str) => {
  if (!str) return false;

  const [p1, p2] = str.split(":");
  const [n1, n2] = [Number(p1), Number(p2)];

  if (!Number.isNaN(n1) && !Number.isNaN(n2)) {
    return true;
  }

  return false;
};

module.exports = {
  isTimeValid,
};
