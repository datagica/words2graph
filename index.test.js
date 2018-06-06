
const { words2edges, words2graph } = require('./index')

const getId = x => x.entityId
const getSentenceIndex = x => x.position.sentence
const getWordIndex = x => x.position.word

test('words2edges should work using a small threshold (50)', () =>
  expect(words2edges({
    positions: require('./tests/test2/input.json'),
    maxDistance: 50,
    getId,
    getSentenceIndex,
    getWordIndex,
  })).toEqual(require('./tests/test2/output.json'))
)
  
test('words2edges should work on a real-world example', () =>
  expect(words2edges({
    positions: require('./tests/test3/input.json'),
    maxDistance: 40000,
    getId,
    getSentenceIndex,
    getWordIndex,
  })).toEqual(require('./tests/test3/output.json'))
)