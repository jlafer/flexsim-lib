import * as R from 'ramda';
import { checkEnumOptions } from '../src/schema';

const enumDimBase = {
  "entity": "workers",
  "phase": "activity",
  "isAttribute": false,
  "dataType": "string",
  "expr": "enum",
  "options": {
    "all": [
      "Available",
      "Busy",
      "Break",
      "Lunch"
    ]
  },
  "optionParams": {
    "all": [
      {
        "baseDur": 90,
        "portion": 0.25
      },
      {
        "baseDur": 15,
        "portion": 0.15
      },
      {
        "baseDur": 30,
        "portion": 0.35
      },
      {
        "baseDur": 120,
        "portion": 0.25
      }
    ]
  },
  "valueCnt": 1,
  "curve": "uniform",
  "min": 0,
  "max": 1,
  "influences": []
};

const makeDim = () => {
  const clone = R.clone(enumDimBase);
  return clone;
};

test('checkEnumOptions passes a valid dimension', () => {
  const dim = makeDim();
  const res = checkEnumOptions(dim);
  expect(res).toEqual(true);
});
