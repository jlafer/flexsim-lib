const { readJsonFile } = require('../src/index');

test("readJsonFile reads a file", () => {
  return readJsonFile('./tests/test.json').then(data => {
    expect(data).toStrictEqual({ foo: 'bar' });
  });
});
