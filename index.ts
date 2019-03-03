import fs from 'fs';
import EventEmitter from 'events';

import { parseMessage, chunksToLines } from './processInput';

import { SystemState, SystemStateEmitter } from './state';
import { createDataSimulation } from './dataSimulation';
import { Readable } from 'stream';
import { createPump } from './pump';
import { getTimeToNextFlip } from './utils';

// This acts as a "dead man's switch" - eg. if the upper trickle bucket sensor fails
const MAX_TIME_PUMP_ENABLED = 30 * 1000; // 30 sec
// The minimum water level allowed (before your pump runs dry)
const CRITICAL_WATER_LEVEL = 7; // 10; // 10 cm from lid
// The depth of the water reservoir in cm
const MAX_WATER_LEVEL = 20;
// This allows to pause the pumping entirely for a certain amount of time (in ms)
const PUMP_INTERVAL = 15 * 60 * 1000; // 15 mins

const FLIP_INDICATION_DATE = getTimeToNextFlip(PUMP_INTERVAL);
console.log({ FLIP_INDICATION_DATE });

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
      pumpIsRunning: false
    },
    config: {
      MAX_TIME_PUMP_ENABLED,
      CRITICAL_WATER_LEVEL,
      MAX_WATER_LEVEL,
      PUMP_INTERVAL,
      FLIP_INDICATION_DATE
    }
  });

  const pump = createPump({ MAX_TIME_PUMP_ENABLED });
  systemStateEmitter.onOperation('PUMP', () => {
    // console.log('maybe starting pump');
    if (!pump.isRunning()) {
      console.log('starting pump');
      pump.start();
    }
  });
  systemStateEmitter.onOperation('STOP_PUMP', operation => {
    // console.log('maybe stopping pump', operation);
    if (pump.isRunning()) {
      console.log('stopping pump', operation);
      pump.stop();
    }
  });

  setInterval(() => systemStateEmitter.emit('PUMP', pump.isRunning()), 500);

  onStart && onStart(systemStateEmitter);
  chunksToLines(dataStream, chunk => {
    if (chunk && chunk.length > 1) {
      dispatchData(chunk, systemStateEmitter);
    }
  });

  return systemStateEmitter;
}

export async function startSimulation(
  onStateChange?: (state: SystemState) => any
) {
  console.log('using data simulation');
  const readStream = createDataSimulation();

  return await initReading(readStream, emitter => {
    onStateChange && emitter.on('state-change', onStateChange);
  });
}

export async function start(onStateChange?: (state: SystemState) => any) {
  try {
    const readStream = fs.createReadStream(
      process.env.DEVICE || '/dev/ttyUSB0'
    );
    return await initReading(readStream, emitter => {
      onStateChange && emitter.on('state-change', onStateChange);
    });
  } catch (error) {
    console.error('unable to create readstream for device', process.env.DEVICE);
    process.exit(1);
    // confuse typescript
    throw error;
  }
}
