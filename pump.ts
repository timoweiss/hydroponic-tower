// @ts-ignore
import rpio from 'rpio';
// rpio.init({ mock: 'raspi-b' });
rpio.init({ mapping: 'physical' });

const PIN_NO = 12;
rpio.open(PIN_NO, rpio.OUTPUT, rpio.HIGH);

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(() => resolve(), ms));

export function createPump({
  getMaxTimePumpEnabled
}: {
  getMaxTimePumpEnabled(): number;
}) {
  let _isRunning = false;
  let lastTimeStarted = 0;
  let lastTimeStoppedByTimer = 0;
  const pump = {
    getTimeLastStarted() {
      return lastTimeStarted;
    },
    isRunning() {
      return _isRunning;
    },
    async start() {
      const MAX_TIME_PUMP_ENABLED =  getMaxTimePumpEnabled()
      if (
        !_isRunning &&
        lastTimeStoppedByTimer &&
        Date.now() - lastTimeStarted < MAX_TIME_PUMP_ENABLED
      ) {
        console.log(
          'Not gonna reenable pump that fast again because it had to be stopped by timer'
        );
        return;
      }
      _isRunning = true;
      lastTimeStarted = Date.now();
      rpio.write(PIN_NO, rpio.LOW);
      await sleep(MAX_TIME_PUMP_ENABLED);
      if (_isRunning) {
        lastTimeStoppedByTimer = Date.now();
        console.log(
          'pump was still running after',
          MAX_TIME_PUMP_ENABLED,
          'ms, stopping it'
        );
        pump.stop();
      }
    },
    async stop() {
      _isRunning = false;
      rpio.write(PIN_NO, rpio.HIGH);
    }
  };
  return pump;
}
