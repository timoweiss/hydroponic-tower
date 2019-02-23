import { Readable } from 'stream';

export async function* chunksToLines(chunksAsync: Readable) {
  let previous = '';
  for await (const chunk of chunksAsync) {
    previous += chunk;
    let eolIndex;
    while ((eolIndex = previous.indexOf('\n')) >= 0) {
      // line includes the EOL
      const line = previous.slice(0, eolIndex + 1);
      yield line;
      previous = previous.slice(eolIndex + 1);
    }
  }
  if (previous.length > 0) {
    yield previous;
  }
}

export function parseMessage(line: string) {
  const [kind, measure] = line.split(':');
  return {
    kind,
    measure: parseInt(measure, 10)
  };
}
