import fs from 'fs';
import EventEmitter from 'events';

import { parseMessage, chunksToLines } from './processInput';
import {
  Operation,
  OperationReasons,
  OperationCommand,
  PumpOperation,
  PumpStopOperation,
  NoOperation
} from './operations';
import { SystemState } from './state';
import { createDataSimulation } from './dataSimulation';
import { Readable } from 'stream';

// This acts as a "dead man's switch" - eg. if the upper trickle bucket sensor fails
const MAX_TIME_PUMP_ENABLED = 5 * 1000; // 5 sec
// The minimum water level allowed (before your pump runs dry)
const CRITICAL_WATER_LEVEL = 7; // 10; // 10 cm from lid
// The depth of the water reservoir in cm
const MAX_WATER_LEVEL = 20;
// This allows to pause the pumping entirely for a certain amount of time (in ms)
const PUMP_INTERVAL = 1 * 60 * 1000; // 15 mins

enum MeasurementTopics {
  WATER_RESERVOIR = 'Distance',
  TRICKLE_BUCKET = 'feucht'
}

const systemState = {
  current: {
    waterReservoirLevel: 0,
    trickleBucket: 0
  },
  history: []
};

interface IMeasurements {
  onOperation(
    cmd: PumpOperation['operationCommand'],
    operationHandler: (operation: PumpOperation) => any
  ): void;
  onOperation(
    cmd: PumpStopOperation['operationCommand'],
    operationHandler: (operation: PumpStopOperation) => any
  ): void;
  onOperation(
    cmd: NoOperation['operationCommand'],
    operationHandler: (operation: NoOperation) => any
  ): void;
}

class Measurements extends EventEmitter {
  emit(topic: MeasurementTopics | string, value: any) {
    // console.info({ topic, value });
    switch (topic) {
      case MeasurementTopics.WATER_RESERVOIR:
        systemState.current.waterReservoirLevel = MAX_WATER_LEVEL - value;
        break;

      case MeasurementTopics.TRICKLE_BUCKET:
        systemState.current.trickleBucket = value;
        break;
      default:
        console.warn('unknown topic', { topic, value });
    }

    super.emit('state-change', systemState.current);

    const operation = deriveOperationFromState(systemState.current);
    return super.emit(
      operation.operationCommand,
      operation.operationCommand === 'STOP_PUMP' ? operation.reason : undefined
    );
  }

  onStateChange(stateChangeHandler: (state: SystemState) => any) {
    super.on('state-change', stateChangeHandler);
  }

  onOperation(
    cmd: OperationCommand,
    operationHandler: (operation: Operation) => any
  ) {
    console.log('registering', { cmd });
    super.on(cmd, operationHandler);
  }
}

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(() => resolve(), ms));

function createPump() {
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
    }
  };
  return pump;
}

// fs.watch('/dev', (eventType, filename) => {
//   if (filename === null && eventType === 'change') {
//     // deletion of a file
//   }
//   if (filename === '') {
//     console.log(filename, {
//       eventType
//     });
//   }
// });

function dispatchData(line: string, eventEmitter: Measurements) {
  const { kind, measure } = parseMessage(line);

  eventEmitter.emit(kind, measure);
}

function isInTimeInterval(interval: number, now: number = Date.now()) {
  return !!(Math.round(now / interval) % 2);
}

function deriveOperationFromState(state: SystemState): Operation {
  console.log({ state });
  if (state.waterReservoirLevel <= CRITICAL_WATER_LEVEL) {
    return {
      operationCommand: 'STOP_PUMP',
      reason: OperationReasons.WATER_RESERVOIR_LEVEL_LOW
    };
  }

  if (state.trickleBucket > 0) {
    return {
      operationCommand: 'STOP_PUMP',
      reason: OperationReasons.TRICKLE_BUCKET_FULL
    };
  }

  if (!isInTimeInterval(PUMP_INTERVAL)) {
    return {
      operationCommand: 'STOP_PUMP',
      reason: OperationReasons.NOT_IN_PUMP_INTERVAL
    };
  }

  return {
    operationCommand: 'PUMP'
  };
}

async function initReading(
  dataStream: Readable,
  onStart?: (emitter: Measurements) => any
) {
  const measurementEmitter = new Measurements();

  const pump = createPump();
  measurementEmitter.onOperation('PUMP', () => {
    // console.log('maybe starting pump');
    if (!pump.isRunning()) {
      console.log('starting pump');
      pump.start();
    }
  });
  measurementEmitter.onOperation('STOP_PUMP', operation => {
    // console.log('maybe stopping pump', operation);
    if (pump.isRunning()) {
      console.log('stopping pump', operation);
      pump.stop();
    }
  });

  onStart && onStart(measurementEmitter);

  for await (const chunk of chunksToLines(dataStream)) {
    if (chunk && chunk.length > 1) {
      dispatchData(chunk, measurementEmitter);
    }
  }
  return measurementEmitter;
}

export async function startSimulation() {
  console.log('using data simulation');
  const readStream = createDataSimulation();
  console.log(
    ',i',
    await initReading(readStream, emitter => {
      emitter.on('state-change', console.log);
    })
  );
}

export async function start() {
  try {
    const readStream = fs.createReadStream(
      process.env.DEVICE || '/dev/ttyUSB0'
    );
    console.log(await initReading(readStream));
  } catch (error) {
    console.error('unable to create readstream for device', process.env.DEVICE);
    process.exit(1);
  }
}

startSimulation();
