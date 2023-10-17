import * as R from 'ramda';

import { getDimension } from './schema';
import { filterDimensions, getDimValue } from './util';

// The main purpose is to calculate new dim values for the valuesDescriptor
// and put them into context.dimValues under 'tasks' or 'workers'.
// It also returns the values calculated for clients that need
// just the newly-calculated values

export function calcDimsValues(ctx, valuesDescriptor) {
  const dimsToCalc = filterDimensions(valuesDescriptor, ctx)
    .filter(dimension => !dimension.hasManualCalculation);
  const values = R.reduce(
    calcAndAccumValue(ctx, valuesDescriptor),
    {},
    dimsToCalc
  );
  return values;
}

const calcAndAccumValue = R.curry((ctx, valuesDescriptor, accum, dimension) => {
  const value = calcAndSaveValue(ctx, valuesDescriptor, dimension);
  return R.assoc(dimension.name, value, accum);
});

const calcAndSaveValue = (ctx, valuesDescriptor, dimension) => {
  const { dimValues } = ctx;
  const value = calcValue(ctx, valuesDescriptor, dimension);
  addDimValueToContext(dimValues, valuesDescriptor, dimension.name, value);
  return value;
};

export const calcValue = R.curry((ctx, valuesDescriptor, dimension) => {
  const value = (dimension.valueCnt === 1)
    ? calcScalarValue(ctx, valuesDescriptor, dimension)
    : calcArrayValue(ctx, valuesDescriptor, dimension);
  return value;
});

const addDimValueToContext = (dimValues, valuesDescriptor, name, value) => {
  const { entity, id } = valuesDescriptor;

  const valuePath = [id, name];
  dimValues[entity] = R.assocPath(valuePath, value, dimValues[entity]);
};

const calcArrayValue = (ctx, valuesDescriptor, dimension) => {
  const res = [];
  for (let i = 0; i < dimension.valueCnt; i++) {
    const value = calcScalarValue(ctx, valuesDescriptor, dimension);
    res.push(value);
  }
  return R.uniq(res);
};

const calcScalarValue = (ctx, valuesDescriptor, dimension) => {
  const value = (dimension.expr === 'range')
    ? calcRangeValue(ctx, valuesDescriptor, dimension)
    : calcEnumValue(ctx, valuesDescriptor, dimension);
  return value;
}

const calcRangeValue = (ctx, valuesDescriptor, dimension) => {
  const { dataType, curve, max, min } = dimension;
  const decValue = (curve == 'uniform')
    ? calcUniformValue(ctx, dimension)
    : calcBellValue(ctx, valuesDescriptor, dimension);
  let value = (dataType === 'integer') ? Math.round(decValue) : decValue;
  if (value > max)
    value = max;
  if (value < min)
    value = min;
  return value;
};

const calcEnumValue = (ctx, valuesDescriptor, dimension) => {
  const { options, optionParams, parent } = dimension;

  const parentValue = (!parent)
    ? 'all'
    : getDimValue(ctx.dimValues, valuesDescriptor.id, getDimension(parent, ctx));
  const portions = optionParams[parentValue].map(R.prop('portion'));
  const randNum = calcUniformValue(ctx, dimension);
  const idx = getPortionsIndexUniform(portions, randNum);
  const value = options[parentValue][idx];
  return value;
};

const calcUniformValue = (ctx, dimension) => {
  const { rng } = ctx;
  const { min, max } = dimension;

  const size = max - min;
  const decValue = (rng() * size) + min;
  return decValue;
};

const calcBellValue = (ctx, valuesDescriptor, dimension) => {
  const { rng } = ctx;
  const { min, max, influences } = dimension;

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
  const { dimValues } = ctx;
  const { entity, id } = valuesDescriptor;
  const shifts = R.map(
    influence => {
      const { factor, amount } = influence;
      const dimension = getDimension(factor, ctx);
      const { min, max } = dimension;
      const factorValue = dimValues[entity][id][factor];
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
  const { rng } = ctx;
  const dimension = getDimension('activity', ctx);
  const valuesDescriptor = { entity: 'workers', phase: 'activity', id: worker.attributes.full_name };
  const activityName = calcEnumValue(ctx, valuesDescriptor, dimension);

  const currActivityName = worker.activityName;
  const idx = dimension.options.all.indexOf(currActivityName);
  if (idx === -1)
    return ['Available', 5000];
  const optionParam = dimension.optionParams.all[idx];
  const delay = randomSkewNormal(rng, optionParam.baseDur, optionParam.baseDur * 0.20, 0);
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
