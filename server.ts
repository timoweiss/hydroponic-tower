import { GraphQLServer, PubSub } from 'graphql-yoga';
import { startSimulation, start } from '.';
import express from 'express';
import { SystemStateEmitter } from './state';

interface IContext {
  systemStateEmitter: SystemStateEmitter;
  pubsub: PubSub;
}

const typeDefs = `
  type Query {
    state: State!
  }
  type Subscription {
    onStateChange: State
    onConfigChange: Config
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
    PUMP_INTERVAL: Int
    FLIP_INDICATION_DATE: Int
  }
`;

const resolvers = {
  Query: {
    state(_: undefined, {}, ctx: IContext) {
      return ctx.systemStateEmitter.systemState.current;
    },
    config(_: undefined, {}, ctx: IContext) {
      return ctx.systemStateEmitter.systemState.config;
    }
  },
  Mutation: {},
  Subscription: {
    onStateChange: {
      subscribe(_: undefined, {}, { pubsub }: IContext) {
        return pubsub.asyncIterator('state-change');
      }
    },
    onConfigChange: {
      subscribe(_: undefined, {}, { pubsub }: IContext) {
        return pubsub.asyncIterator('config-change');
      }
    }
  }
};

async function setupSystem() {
  const systemStateEmitter = await start();
  const pubsub = new PubSub();
  // map state to pubsub
  systemStateEmitter.onStateChange(state =>
    pubsub.publish('state-change', state)
  );
  // map config to pubsub
  systemStateEmitter.onConfigChange(config =>
    pubsub.publish('config-change', config)
  );

  const server = new GraphQLServer({
    typeDefs,
    resolvers,
    context: { pubsub, systemStateEmitter }
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
