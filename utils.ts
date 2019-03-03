// this function tries to find the milliseconds
export function getTimeToNextFlip(interval: number, ref: number = Date.now()) {
  let startingNow = ref;
  const currentIntervalValue = isInTimeInterval(interval, startingNow);
  for (let index = 0; index < interval; index++) {
    // we test for each iteration if the value would flip with an additional millisecond (increase for performace but decreased precision [max interval - 1])
    startingNow = startingNow + 1;
    const res = isInTimeInterval(interval, startingNow);
    if (res !== currentIntervalValue) {
      break;
    }
  }
  return startingNow - ref;
}

export function isInTimeInterval(interval: number, now: number = Date.now()) {
  return !!(Math.round(now / interval) % 2);
}
