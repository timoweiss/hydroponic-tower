// @ts-ignore
import rpio from 'rpio';
// rpio.init({ mock: 'raspi-b' });
rpio.init({ mapping: 'physical' });

// rpio.on('warn', () => console.log('waring from pi'));
const PIN_NO = 12;
rpio.open(PIN_NO, rpio.OUTPUT, rpio.LOW);

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(() => resolve(), ms));

export function createPump({
  MAX_TIME_PUMP_ENABLED
}: {
  MAX_TIME_PUMP_ENABLED: number;
}) {
  let _isRunning = false;
  let lastTimeStarted = 0;
  const pump = {
    getTimeLastStarted() {
      return lastTimeStarted;
    },
    isRunning() {
      return _isRunning;
    },
    async start() {
      _isRunning = true;
      lastTimeStarted = Date.now();
      rpio.write(PIN_NO, rpio.HIGH);
      await sleep(MAX_TIME_PUMP_ENABLED);
      if (_isRunning) {
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
      rpio.write(PIN_NO, rpio.LOW);
    }
  };
  return pump;
}
