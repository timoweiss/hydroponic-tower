import * as path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

import { GraphQLServer, PubSub } from 'graphql-yoga';
import { startSimulation, start } from '.';
import express from 'express';
import { SystemStateEmitter } from './state';
import { CronJob, CronTime } from 'cron';
import { createSheetwriter } from './spreadsheet';

interface IContext {
  systemStateEmitter: SystemStateEmitter;
  pubsub: PubSub;
  cronJob: CronJob;
}

const typeDefs = `
scalar Date
scalar JSON

  type Query {
    state: State!
    config: Config!
    nextPlannedPumpDate: Date!
  }
  type Subscription {
    onStateChange: State!
    onConfigChange: Config!
  }

  type Mutation {
    setConfigKey(key: String!, value: JSON!): Config!
  }

  type State {
    waterReservoirLevel: Int
    trickleBucket: Int
    pumpIsRunning: Boolean
  }
  type Config {
    MAX_TIME_PUMP_ENABLED: Int
    CRITICAL_WATER_LEVEL: Int
    MAX_WATER_LEVEL: Int
    PUMP_ACTIVATE_CRON: String
  }
`;

const resolvers = {
  Query: {
    state(_: undefined, { }, ctx: IContext) {
      return ctx.systemStateEmitter.systemState.current;
    },
    config(_: undefined, { }, ctx: IContext) {
      return ctx.systemStateEmitter.systemState.config.getAll();
    },
    nextPlannedPumpDate(_: undefined, { }, ctx: IContext) {
      return ctx.cronJob.nextDate();
    }
  },
  Mutation: {
    setConfigKey(_: undefined, { key, value }: { key: any, value: any }, ctx: IContext) {
      ctx.systemStateEmitter.systemState.config.set(key, value);

      if (key === 'PUMP_ACTIVATE_CRON') {
        ctx.cronJob.setTime(new CronTime(value));
      }

      ctx.pubsub.publish('config-change', { onConfigChange: ctx.systemStateEmitter.systemState.config.getAll() })

      return ctx.systemStateEmitter.systemState.config.getAll()
    },

  },
  Subscription: {
    onStateChange: {
      subscribe(_: undefined, { }, { pubsub }: IContext) {
        return pubsub.asyncIterator('state-change');
      }
    },
    onConfigChange: {
      subscribe(_: undefined, { }, { pubsub }: IContext) {
        return pubsub.asyncIterator('config-change');
      }
    }
  }
};

async function setupSystem() {

  const db = await createSheetwriter({ sheetId: '1x0TkrN9KrUCyN2vPA6AFZ9l03PkZc2u3qP1EPrw6NCc' })
  const { systemStateEmitter, cronJob } = await start();
  const pubsub = new PubSub();
  // map state to pubsub
  systemStateEmitter.onStateChange(state => {
    db.addStats({ ...state, date: new Date() });
    console.log('state-change', { state })
    pubsub.publish('state-change', { onStateChange: state })
  });
  // map config to pubsub
  systemStateEmitter.onConfigChange(config => {

    console.log('config-change', { config })
    pubsub.publish('config-change', { onConfigChange: config });
  }
  );

  const server = new GraphQLServer({
    typeDefs,
    resolvers,
    context: { pubsub, systemStateEmitter, cronJob }
  });
  server.start(
    { port: 3333, endpoint: '/graphql', playground: '/playground' },
    async config => {
      console.log('Server is running on localhost:' + config.port);
    }
  );

  server.express.use('/', express.static('client'));
}

setupSystem()
  .then(() => console.log('system started'))
  .catch(error => console.error('system failed', error));
