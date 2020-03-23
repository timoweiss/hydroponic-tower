import { Operation, OperationReasons, OperationCommand } from './operations';
import { EventEmitter } from 'events';
import { MeasurementTopics } from './processInput';
import { createValueConfigStore } from './variables';

export interface SystemState {
  current: {
    waterReservoirLevel: number;
    trickleBucket: number;
    pumpIsRunning: boolean;
  };
  config: ReturnType<typeof createValueConfigStore>;
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
    const configStateStringified = JSON.stringify(this.systemState.config.getAll());

    switch (topic) {
      case MeasurementTopics.WATER_RESERVOIR:
        current.waterReservoirLevel = config.get('MAX_WATER_LEVEL') - value;
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
    const [dataHasChanged, configHasChanged] = [
      currentStateStringified !== JSON.stringify(current),
      configStateStringified !== JSON.stringify(config.getAll())
    ];
    // only emit state-change if it has actually changed - not really fancy but should work for data only
    if (dataHasChanged || configHasChanged) {
      // notify possible external listeners
      dataHasChanged && super.emit('state-change', current);
      configHasChanged && super.emit('config-change', config);

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

export function isItSafeToActivatePump(state: SystemState) {
  if (state.current.trickleBucket > 0) {
    console.log('it is not safe to activate the pump because the trickle bucket seems to be full');
    return false;
  }
  if(state.current.waterReservoirLevel <= state.config.get('CRITICAL_WATER_LEVEL')) {
    console.log('it is not safe to activate the pump because of the water level is too low');
    return false;
  }
  return true;
}

export function deriveOperationFromState(state: SystemState): Operation {
  if (state.current.trickleBucket > 0) {
    return {
      operationCommand: 'STOP_PUMP',
      reason: OperationReasons.TRICKLE_BUCKET_FULL
    };
  }

  if (state.current.waterReservoirLevel <= state.config.get('CRITICAL_WATER_LEVEL')) {
    return {
      operationCommand: 'STOP_PUMP',
      reason: OperationReasons.WATER_RESERVOIR_LEVEL_LOW
    };
  }

  if(!!true) {
    return {operationCommand: 'NO_OP'}
  }
  return {
    operationCommand: 'PUMP'
  };
}
