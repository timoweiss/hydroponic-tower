import { Readable } from 'stream';

export async function chunksToLines(
  chunksAsync: Readable,
  onData: (line: string) => any
) {
  let previous = '';
  chunksAsync.on('data', chunk => {
    previous += chunk;
    let eolIndex;
    while ((eolIndex = previous.indexOf('\n')) >= 0) {
      // line includes the EOL
      const line = previous.slice(0, eolIndex + 1);
      onData(line);
      previous = previous.slice(eolIndex + 1);
    }
  });

  if (previous.length > 0) {
    onData(previous);
  }
}

export enum MeasurementTopics {
  WATER_RESERVOIR = 'Distance',
  TRICKLE_BUCKET = 'feucht'
}

export function parseMessage(
  line: string
): {
  kind: MeasurementTopics;
  measure: number;
} {
  const [kind, measure] = line.split(':') as [MeasurementTopics, string];
  return {
    kind,
    measure: parseInt(measure, 10)
  };
}
