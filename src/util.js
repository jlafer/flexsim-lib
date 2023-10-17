import * as R from 'ramda';
import { fakerEN, fakerDE, fakerES, fakerFR } from '@faker-js/faker';

export const findObjInList = R.curry((key, val, arr) =>
  R.find(obj => (obj[key] === val), arr)
);

export const filterObjInList = R.curry((key, val, arr) =>
  R.filter(obj => (obj[key] === val), arr)
);

export const getAttributeFromJson = (jsonStr, key) => {
  return JSON.parse(jsonStr)[key]
};

export const getDimValues = (ctx, valuesDescriptor) => {
  const { dimValues } = ctx;
  const entDimensions = filterDimensionsByEntity(valuesDescriptor.entity, ctx);
  const values = R.reduce(
    getAndAccumValue(dimValues, valuesDescriptor.id),
    {},
    entDimensions
  );
  return values;
};

export const getAttributes = (ctx, valuesDescriptor) => {
  const { dimValues } = ctx;
  const attrDimensions = filterDimensionsByEntity(valuesDescriptor.entity, ctx)
    .filter(dimension => dimension.isAttribute);
  const attributes = R.reduce(
    getAndAccumValue(dimValues, valuesDescriptor.id),
    {},
    attrDimensions
  );
  return attributes;
};

const getAndAccumValue = R.curry((dimValues, id, accum, dimension) => {
  const { entity, name } = dimension;
  const value = R.path([entity, id, name], dimValues);
  return R.assoc(name, value, accum);
});

export const getDimValue = (dimValues, id, dimension) => {
  const { entity, name } = dimension;
  const value = R.path([entity, id, name], dimValues);
  return value;
};

export const getDimOptionParam = (key, parentValue, value, dimension) => {
  const idx = R.indexOf(value, dimension.options[parentValue]);
  return dimension.optionParams[parentValue][idx][key];
};

export const hasAttributeValue = R.curry((key, val, obj) => obj.attributes[key] === val);

export const sortDimsByFactors = (ctx) => {
  const sorted = [];
  const deployDims = filterDimensionsByPhase('deploy', ctx);
  const activityDims = filterDimensionsByPhase('activity', ctx);
  const arriveDims = filterDimensionsByPhase('arrive', ctx);
  const assignDims = filterDimensionsByPhase('assign', ctx);
  const completeDims = filterDimensionsByPhase('complete', ctx);

  sortAndAddDimensions(sorted, deployDims);
  sortAndAddDimensions(sorted, activityDims);
  sortAndAddDimensions(sorted, arriveDims);
  sortAndAddDimensions(sorted, assignDims);
  sortAndAddDimensions(sorted, completeDims);
  return sorted;
}

const sortAndAddDimensions = (sorted, dimensions) => {
  let itemWasAdded;
  let addedCnt = 0;
  do {
    itemWasAdded = false;
    dimensions.forEach(dim => {
      if (!inSorted(sorted, dim) && hasAllDependencies(sorted, dim)) {
        sorted.push(dim);
        itemWasAdded = true;
        addedCnt += 1;
      }
    })
  } while (itemWasAdded);
  if (addedCnt === dimensions.length)
    return;
  throw new Error(`dimensions influences contain a circular or missing dependency`);
};

export const filterDimensions = (valuesDescriptor, ctx) => {
  const { entity, phase } = valuesDescriptor;
  const dimsByEntity = filterDimensionsByEntity(entity, ctx);
  return filterDimListByPhase(phase, dimsByEntity);
};

export const filterDimensionsByPhase = (phase, ctx) => filterDimListByPhase(phase, ctx.cfg.metadata.dimensions);

const filterDimListByPhase = (phase, dims) => {
  return R.filter(dim => dim.phase === phase, dims);
};

export const filterDimensionsByEntity = (entity, ctx) => filterDimListByEntity(entity, ctx.cfg.metadata.dimensions);

const filterDimListByEntity = (entity, dims) => {
  return R.filter(dim => dim.entity === entity, dims);
};

const inSorted = (sorted, dim) => R.any(p => p.dimName === dim.dimName, sorted);

const hasAllDependencies = (sorted, dim) => {
  const dependencyNames = getFactorDimNames(dim.influences);
  if (!!dim.parent) {
    dependencyNames.push(dim.parent);
  }
  return R.all(nameInDimList(sorted), dependencyNames);
};

const getFactorDimNames = (influences) => influences.map(R.prop('factor'));

const nameInDimList = R.curry((dimensions, name) => {
  return R.any(p => p.name === name, dimensions);
});

export const sumValuesForKey = R.curry((valueKey, arr) => {
  return R.pipe(
    R.map(R.propOr(0.0, valueKey)),
    R.reduce(R.add, 0.0))(arr);
});

export function formatDt(tsMsec) {
  const dt = new Date(tsMsec);
  return dt.toLocaleTimeString();
}

export function formatSid(sid) {
  return `${sid.slice(0, 2)}...${sid.slice(-4)}`
}

const fakerModules = {
  'EN': fakerEN,
  'DE': fakerDE,
  'ES': fakerES,
  'FR': fakerFR,
};

export function localeToFakerModule(locale) {
  const lang = locale.slice(0, 2).toUpperCase();
  const module = fakerModules[lang] || fakerModules['EN'];
  return module;
}
