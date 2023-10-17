import * as R from 'ramda';
import seedrandom from 'seedrandom';

export const enumDimBase = {
  "dataType": "string",
  "expr": "enum",
  "min": 0,
  "max": 1,
  "curve": "uniform",
  "isAttribute": false,
  "influences": [],
  "valueCnt": 1,
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
  }
};

export const rangeDimBase = {
  "name": "testRangeDim",
  "dataType": "integer",
  "expr": "range",
  "min": 0,
  "max": 100,
  "entity": "tasks",
  "attrName": "testRangeDim",
  "phase": "assign",
  "curve": "bell",
  "isAttribute": true,
  "influences": [],
  "valueCnt": 1,
};

export const overrideDimension = (baseDimension, name, overrides) => {
  const clone = R.clone(baseDimension);
  clone.name = name;
  clone.attrName = name;
  const res = R.mergeRight(clone, overrides);
  return res;
};

export const makeCtx = (dimensions, dimValues) => {
  const ctx = {};
  ctx.dimValues = R.clone(dimValues);
  ctx.cfg = {};
  ctx.cfg.metadata = {};
  ctx.cfg.metadata.dimensions = dimensions;
  ctx.rng = seedrandom('predictable');
  return ctx;
};
