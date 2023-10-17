import * as R from 'ramda';

import { enumDimBase, rangeDimBase, makeCtx, overrideDimension } from './util';
import { calcDimsValues, calcValue } from '../src/calcs';

const activityDim = overrideDimension(
  enumDimBase,
  'activity',
  { "entity": "workers", "phase": "activity" }
);

const prereq1 = overrideDimension(rangeDimBase, 'prereq1', { phase: 'arrive' });
const prereq2 = overrideDimension(rangeDimBase, 'prereq2', { phase: 'arrive' });
const prereq3 = overrideDimension(rangeDimBase, 'prereq3', { phase: 'arrive' });

const bellShiftDim = overrideDimension(rangeDimBase, 'bellShift', {
  phase: 'assign',
  influences: [
    {
      "factor": "prereq1",
      "effect": "shift",
      "amount": "0.20"
    }
  ]
});

const dimensions = [
  prereq1,
  prereq2,
  prereq3,
  rangeDimBase,
  activityDim
];

const id = 'abcde';

const dimValuesBase = {
  tasks: {
    [id]: {
      prereq1: 75,
      prereq2: 50,
      prereq3: 25
    }
  },
  workers: {
    [id]: {}
  }
};

const workersValuesDescriptor = { entity: 'workers', phase: 'activity', id };
const tasksValuesDescriptor = { entity: 'tasks', phase: 'assign', id };

test('calculates an enum value', () => {
  const ctx = makeCtx(dimensions, dimValuesBase);
  const expected = { activity: 'Busy' };
  const res = calcDimsValues(ctx, workersValuesDescriptor);
  expect(res).toStrictEqual(expected);
});

test('calculates a range-bell value', () => {
  const ctx = makeCtx(dimensions, dimValuesBase);
  const expected = { testRangeDim: 58 };
  const res = calcDimsValues(ctx, tasksValuesDescriptor);
  expect(res).toStrictEqual(expected);
});

test('calculates a range-bell value with a shift', () => {
  const ctx = makeCtx([prereq1, bellShiftDim], dimValuesBase);
  const expected = { bellShift: 63 };
  const res = calcDimsValues(ctx, tasksValuesDescriptor);
  expect(res).toStrictEqual(expected);
});

test('calculates many range-bell values accurately', () => {
  const ctx = makeCtx(dimensions, dimValuesBase);
  const count = 1000;
  const expected = 50;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const value = calcValue(ctx, tasksValuesDescriptor, rangeDimBase);
    //console.log(value);
    sum = sum + value;
  }
  const res = Math.round(sum / count);
  expect(res).toBe(expected);
});

test('calculates many bell-shifted values accurately', () => {
  const ctx = makeCtx([prereq1, bellShiftDim], dimValuesBase);
  const count = 1000;
  const expected = 55;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const value = calcValue(ctx, tasksValuesDescriptor, bellShiftDim);
    sum = sum + value;
  }
  const res = Math.round(sum / count);
  expect(res).toBe(expected);
});
