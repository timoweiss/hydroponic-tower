export type OperationCommand = 'PUMP' | 'STOP_PUMP' | 'NO_OP';

export enum OperationReasons {
  WATER_RESERVOIR_LEVEL_LOW = 'WATER_RESERVOIR_LEVEL_LOW',
  TRICKLE_BUCKET_FULL = 'TRICKLE_BUCKET_FULL',
  NOT_IN_PUMP_INTERVAL = 'NOT_IN_PUMP_INTERVAL'
}
interface BaseOperation {
  operationCommand: OperationCommand;
}

export interface PumpOperation extends BaseOperation {
  operationCommand: 'PUMP';
}
export interface PumpStopOperation extends BaseOperation {
  operationCommand: 'STOP_PUMP';
  reason: OperationReasons;
}
export interface NoOperation extends BaseOperation {
  operationCommand: 'NO_OP';
}
export type Operation = PumpOperation | PumpStopOperation | NoOperation;
