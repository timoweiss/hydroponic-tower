import { isInTimeInterval } from './utils';
import { Operation, OperationReasons, OperationCommand } from './operations';
import { EventEmitter } from 'events';
import { MeasurementTopics } from './processInput';

export interface SystemState {
  current: {
    waterReservoirLevel: number;
    trickleBucket: number;
    pumpIsRunning: boolean;
  };
  config: {
    MAX_TIME_PUMP_ENABLED: number;
    CRITICAL_WATER_LEVEL: number;
    MAX_WATER_LEVEL: number;
    PUMP_INTERVAL: number;
    FLIP_INDICATION_DATE: number;
  };
}

export class SystemStateEmitter extends EventEmitter {
  public systemState: SystemState;
  constructor(initialSystemState: SystemState) {
    super();
    this.systemState = initialSystemState;
  }
  emit(topic: MeasurementTopics | string, value: any) {
    const { current, config } = this.systemState;

    const currentStateStringified = JSON.stringify(this.systemState.current);
    const configStateStringified = JSON.stringify(this.systemState.config);

    switch (topic) {
      case MeasurementTopics.WATER_RESERVOIR:
        current.waterReservoirLevel = config.MAX_WATER_LEVEL - value;
        break;

      case MeasurementTopics.TRICKLE_BUCKET:
        current.trickleBucket = value;
        break;
      case 'PUMP':
        current.pumpIsRunning = !!value;
        break;
      default:
        console.warn('unknown topic', { topic, value });
    }
    const [dataHasChanged, confighasChanged] = [
      currentStateStringified !== JSON.stringify(current),
      configStateStringified !== JSON.stringify(config)
    ];
    // only emit state-change if it has actually changed - not really fancy but should work for data only
    if (dataHasChanged || confighasChanged) {
      // notify possible external listeners
      dataHasChanged && super.emit('state-change', current);
      confighasChanged && super.emit('config-change', config);

      const operation = deriveOperationFromState(this.systemState);
      return super.emit(
        operation.operationCommand,
        operation.operationCommand === 'STOP_PUMP'
          ? operation.reason
          : undefined
      );
    }
    return false;
  }

  onStateChange(stateChangeHandler: (state: SystemState['current']) => any) {
    super.on('state-change', stateChangeHandler);
  }
  onConfigChange(configChangeHandler: (config: SystemState['config']) => any) {
    super.on('config-change', configChangeHandler);
  }

  onOperation(
    cmd: OperationCommand,
    operationHandler: (operation: Operation) => any
  ) {
    console.log('registering', { cmd });
    super.on(cmd, operationHandler);
  }
}

export function deriveOperationFromState(state: SystemState): Operation {
  if (!isInTimeInterval(state.config.PUMP_INTERVAL)) {
    return {
      operationCommand: 'STOP_PUMP',
      reason: OperationReasons.NOT_IN_PUMP_INTERVAL
    };
  }

  if (state.current.trickleBucket > 0) {
    return {
      operationCommand: 'STOP_PUMP',
      reason: OperationReasons.TRICKLE_BUCKET_FULL
    };
  }

  if (state.current.waterReservoirLevel <= state.config.CRITICAL_WATER_LEVEL) {
    return {
      operationCommand: 'STOP_PUMP',
      reason: OperationReasons.WATER_RESERVOIR_LEVEL_LOW
    };
  }

  return {
    operationCommand: 'PUMP'
  };
}
