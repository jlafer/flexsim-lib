import * as R from 'ramda';

import { getSingleDimInstance } from './schema';
import { filterDimInstances } from './util';

export function calcDimsValues(ctx, valuesDescriptor) {
  const { dimInstances } = ctx;
  const instancesToCalc = filterDimInstances(valuesDescriptor, dimInstances)
    .filter(dimAndInst => !dimAndInst.hasManualCalculation);
  const values = R.reduce(
    calcAndAccumValue(ctx, valuesDescriptor),
    {},
    instancesToCalc
  );
  return values;
}

const calcAndAccumValue = R.curry((ctx, valuesDescriptor, accum, dimAndInst) => {
  const value = calcAndSaveValue(ctx, valuesDescriptor, dimAndInst);
  const keyPath = R.split('.', dimAndInst.instName);
  return R.assocPath(keyPath, value, accum);
});

const calcAndSaveValue = (ctx, valuesDescriptor, dimAndInst) => {
  const { dimValues } = ctx;
  const value = calcValue(ctx, valuesDescriptor, dimAndInst);
  const keyPath = R.split('.', dimAndInst.instName);
  addDimValueToContext(dimValues, valuesDescriptor, keyPath, value);
  return value;
};

export const calcValue = R.curry((ctx, valuesDescriptor, dimAndInst) => {
  const value = (dimAndInst.valueCnt === 1)
    ? calcScalarValue(ctx, valuesDescriptor, dimAndInst)
    : calcArrayValue(ctx, valuesDescriptor, dimAndInst);
  return value;
});

const addDimValueToContext = (dimValues, valuesDescriptor, keyPath, value) => {
  const { id, entity } = valuesDescriptor;
  dimValues[entity][id] = R.assocPath(
    keyPath,
    value,
    dimValues[entity][id]
  );
};

const calcArrayValue = (ctx, valuesDescriptor, dimAndInst) => {
  const res = [];
  for (let i = 0; i < dimAndInst.valueCnt; i++) {
    const value = calcScalarValue(ctx, valuesDescriptor, dimAndInst);
    res.push(value);
  }
  return R.uniq(res);
};

const calcScalarValue = (ctx, valuesDescriptor, dimAndInst) => {
  const value = (dimAndInst.expr === 'range')
    ? calcRangeValue(ctx, valuesDescriptor, dimAndInst)
    : calcEnumValue(ctx, dimAndInst);
  return value;
}

const calcRangeValue = (ctx, valuesDescriptor, dimAndInst) => {
  const { dataType, curve, max, min } = dimAndInst;
  const decValue = (curve == 'uniform')
    ? calcUniformValue(ctx, dimAndInst)
    : calcBellValue(ctx, valuesDescriptor, dimAndInst);
  let value = (dataType === 'integer') ? Math.round(decValue) : decValue;
  if (value > max)
    value = max;
  if (value < min)
    value = min;
  return value;
};

const calcEnumValue = (ctx, dimAndInst) => {
  const { values, valueParams } = dimAndInst;
  const portions = valueParams.map(R.prop('portion'));
  const randNum = calcUniformValue(ctx, dimAndInst);
  const idx = getPortionsIndexUniform(portions, randNum);
  const value = values[idx];
  return value;
};

const calcUniformValue = (ctx, dimAndInst) => {
  const { rng } = ctx;
  const { min, max } = dimAndInst;
  const size = max - min;
  const decValue = (rng() * size) + min;
  return decValue;
};

const calcBellValue = (ctx, valuesDescriptor, dimAndInst) => {
  const { rng } = ctx;
  const { min, max, influences } = dimAndInst;
  const size = max - min;
  const mean = min + (size / 2);
  const stddev = size / 10;
  const shift = calculateInfluencesAmount(ctx, valuesDescriptor, influences);
  const decValue = randomSkewNormal(rng, mean + shift, stddev, 0);
  return decValue;
};

const calculateInfluencesAmount = (ctx, valuesDescriptor, influences) => {
  if (influences.length === 0)
    return 0;
  const { dimInstances, dimValues } = ctx;
  const { entity, id } = valuesDescriptor;
  const shifts = R.map(
    influence => {
      const { factor, amount } = influence;
      const [_dim, instName] = factor.split('.');
      const dimAndInst = getSingleDimInstance(instName, dimInstances);
      const { min, max } = dimAndInst;
      const factorValue = dimValues[entity][id][instName];
      const size = max - min;
      const mean = min + (size / 2);
      const factorDiff = (factorValue - mean);
      return factorDiff * amount;
    },
    influences
  )
  const amount = R.reduce((accum, value) => accum + value, 0, shifts);
  return amount;
};

export function calcActivityChange(ctx, worker) {
  const { dimInstances, rng } = ctx;
  const dimAndInst = getSingleDimInstance('activity', dimInstances);
  const activityName = calcEnumValue(ctx, dimAndInst);

  const currActivityName = worker.activityName;
  const idx = dimAndInst.values.indexOf(currActivityName);
  if (idx === -1)
    return ['Available', 5000];
  const valueParam = dimAndInst.valueParams[idx];
  const delay = randomSkewNormal(rng, valueParam.baseDur, valueParam.baseDur * 0.20, 0);
  const delayMsec = Math.round(delay * 1000);

  return [activityName, delayMsec];
}

function getPortionsIndexUniform(mapping, randNum) {
  let upper = 0.0;
  let idx;
  for (let i = 0; i < mapping.length; i++) {
    upper += mapping[i];
    if (upper > randNum) {
      idx = i;
      break;
    }
  }
  return idx;
}

// use Box-Muller transform to create normal variates, u0 and v,
// from uniform variates 
const randomNormals = (rng) => {
  let u1 = 0, u2 = 0;
  // convert [0,1) to (0,1)
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  const R = Math.sqrt(-2.0 * Math.log(u1));
  const Θ = 2.0 * Math.PI * u2;
  return [R * Math.cos(Θ), R * Math.sin(Θ)];
};

const randomSkewNormal = (rng, mean, stddev, skew = 0) => {
  const [u0, v] = randomNormals(rng);
  if (skew === 0)
    return mean + stddev * u0;
  const correlation = skew / Math.sqrt(1 + skew * skew);
  const u1 = correlation * u0 + Math.sqrt(1 - correlation * correlation) * v;
  const z = u0 >= 0 ? u1 : -u1;
  return mean + stddev * z;
};
