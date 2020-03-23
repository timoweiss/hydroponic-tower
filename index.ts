import fs from 'fs';

import { CronJob } from 'cron';


import { parseMessage, chunksToLines } from './processInput';

import { SystemState, SystemStateEmitter, isItSafeToActivatePump } from './state';
import { createDataSimulation } from './dataSimulation';
import { Readable } from 'stream';
import { createPump } from './pump';
import { createValueConfigStore } from './variables';

// This acts as a "dead man's switch" - eg. if the upper trickle bucket sensor fails
const MAX_TIME_PUMP_ENABLED = 10 * 1000; // 30 sec
// The minimum water level allowed (before your pump runs dry)
const CRITICAL_WATER_LEVEL = 7; // 10; // 10 cm from lid
// The depth of the water reservoir in cm (measured from the sensor)
const MAX_WATER_LEVEL = 23;

// Cron pattern which controlls WHEN the pump should be activated
const PUMP_ACTIVATE_CRON = '0 * * * * *';


const valueStore = createValueConfigStore({ CRITICAL_WATER_LEVEL, MAX_TIME_PUMP_ENABLED, MAX_WATER_LEVEL, PUMP_ACTIVATE_CRON })

function dispatchData(line: string, eventEmitter: SystemStateEmitter) {
  const { kind, measure } = parseMessage(line);

  eventEmitter.emit(kind, measure);
}

async function initReading(
  dataStream: Readable,
  onStart?: (emitter: SystemStateEmitter) => any
) {
  const systemStateEmitter = new SystemStateEmitter({
    current: {
      waterReservoirLevel: 0,
      trickleBucket: 0,
      pumpIsRunning: false,
    },
    config: valueStore
  });

  const pump = createPump({ getMaxTimePumpEnabled: () => valueStore.get('MAX_TIME_PUMP_ENABLED') });

  const job = new CronJob(valueStore.get('PUMP_ACTIVATE_CRON'), () => {
    console.log('check if we need to activate pump');
    if (isItSafeToActivatePump(systemStateEmitter.systemState)) {
      console.log('activating pump');
      pump.start();
    }
  });

  job.start();

  // systemStateEmitter.onOperation('PUMP', () => {
  //   // console.log('maybe starting pump');
  //   if (!pump.isRunning()) {
  //     console.log('starting pump');
  //     // pump.start();
  //   }
  // });
  systemStateEmitter.onOperation('STOP_PUMP', operation => {
    // console.log('maybe stopping pump', operation);
    if (pump.isRunning()) {
      console.log('stopping pump', operation);
      pump.stop();
    }2
  });

  // map pump state changes
  setInterval(() => systemStateEmitter.emit('PUMP', pump.isRunning()), 500);

  onStart && onStart(systemStateEmitter);
  chunksToLines(dataStream, chunk => {
    if (chunk && chunk.length > 1) {
      dispatchData(chunk, systemStateEmitter);
    }
  });

  return { systemStateEmitter, cronJob: job };
}

export async function startSimulation(
  onStateChange?: (state: SystemState) => any
) {
  console.log('using data simulation');
  const readStream = createDataSimulation();

  return initReading(readStream, emitter => {
    onStateChange && emitter.on('state-change', onStateChange);
  });
}

export async function start(onStateChange?: (state: SystemState) => any) {
  try {
    const readStream = fs.createReadStream(
      process.env.DEVICE || '/dev/ttyUSB0'
    );
    return initReading(readStream, emitter => {
      onStateChange && emitter.on('state-change', onStateChange);
    });
  } catch (error) {
    console.error('unable to create readstream for device', process.env.DEVICE);
    process.exit(1);
    // confuse typescript
    throw error;
  }
}
