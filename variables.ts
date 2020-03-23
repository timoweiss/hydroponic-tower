
interface IConfig {
  MAX_TIME_PUMP_ENABLED: number;
  CRITICAL_WATER_LEVEL: number;
  MAX_WATER_LEVEL: number;
  PUMP_ACTIVATE_CRON: string;
}

export const createValueConfigStore = (initialValues: IConfig) => {
  const globalStore = initialValues;
  return {
    set<T extends keyof IConfig>(key: T, value: IConfig[T]) {
      globalStore[key] = value;
    },
    get<T extends keyof IConfig>(key: T): IConfig[T] {
      return globalStore[key];
    },
    getAll() {
      return globalStore;
    }
  }
}
