import { DocumentParserFactory } from './document-parser.factory';
import { AdaptiveParserStrategy } from '../strategies/adaptive-parser.strategy';

describe('DocumentParserFactory', () => {
  it('returns the adaptive parser for any markdown', () => {
    const adaptive = {} as AdaptiveParserStrategy;
    const factory = new DocumentParserFactory(adaptive);
    expect(factory.getParser('# anything')).toBe(adaptive);
  });
});
