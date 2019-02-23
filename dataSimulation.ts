import stream, { Readable } from 'stream';

const simulation = require('./simulationData.json');

export function createDataSimulation() {
  const readable = new stream.Readable();
  readable._read = () => null;

  const interval: NodeJS.Timeout = setInterval(() => {
    if (!simulation.length) {
      return end(readable, interval);
    }
    readable.push(simulation.shift() + '\n');
  }, 500);

  setTimeout(() => {
    end(readable, interval);
  }, 1000000);
  return readable;
}

function end(s: Readable, interval: NodeJS.Timeout) {
  console.log('ending simulation');
  clearInterval(interval);
  s.emit('end');
}
