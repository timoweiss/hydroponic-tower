import { GraphQLServer, PubSub } from 'graphql-yoga';
import { startSimulation, systemState, start } from '.';
import express from 'express';

const typeDefs = `
  type Query {
    state: State!
  }
  type Subscription {
    onStateChange: State
  }
  type Mutation {
    startSimulation:Boolean
    start:Boolean
  }

  type State {
    waterReservoirLevel: Int
    trickleBucket: Int
  }
`;

const pubsub = new PubSub();

const resolvers = {
  Query: {
    state() {
      return systemState.current;
    }
  },
  Mutation: {
    start() {
      start(state => pubsub.publish('state-change', { onStateChange: state }));
      return true;
    },
    startSimulation() {
      startSimulation(state =>
        pubsub.publish('state-change', { onStateChange: state })
      );
      return true;
    }
  },
  Subscription: {
    onStateChange: {
      subscribe: (_: undefined, args: object, { pubsub }: any) => {
        return pubsub.asyncIterator('state-change');
      }
    }
  }
};

const server = new GraphQLServer({
  typeDefs,
  resolvers,
  context: { pubsub }
});
server.start(
  { port: 3333, endpoint: '/graphql', playground: '/playground' },
  config => console.log('Server is running on localhost:' + config.port)
);

server.express.use('/', express.static('client'));
