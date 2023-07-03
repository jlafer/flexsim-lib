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
  const { dimInstances, dimValues } = ctx;
  const entDimInstances = filterDimInstancesByEntity(valuesDescriptor.entity, dimInstances);
  const values = R.reduce(
    getAndAccumValue(dimValues, valuesDescriptor.id),
    {},
    entDimInstances
  );
  return values;
};

export const getAttributes = (ctx, valuesDescriptor) => {
  const { dimInstances, dimValues } = ctx;
  const attrDimInstances = filterDimInstancesByEntity(valuesDescriptor.entity, dimInstances)
    .filter(dimAndInst => dimAndInst.isAttribute);
  const attributes = R.reduce(
    getAndAccumValue(dimValues, valuesDescriptor.id),
    {},
    attrDimInstances
  );
  return attributes;
};

const getAndAccumValue = R.curry((dimValues, id, accum, dimAndInst) => {
  const { entity, instName } = dimAndInst;
  const keyPath = R.split('.', instName);
  const valuePath = R.concat([entity, id], keyPath);
  const value = R.path(valuePath, dimValues);
  return R.assocPath(keyPath, value, accum);
});

export const getDimValue = (dimValues, id, dimAndInst) => {
  const { entity, instName } = dimAndInst;
  const keyPath = R.split('.', instName);
  const valuePath = R.concat([entity, id], keyPath);
  const value = R.path(valuePath, dimValues);
  return value;
};

export const getDimValueParam = (key, value, dimAndInst) => {
  const idx = R.indexOf(value, dimAndInst.values);
  return dimAndInst.valueParams[idx][key];
};

export const hasAttributeValue = R.curry((key, val, obj) => obj.attributes[key] === val);

export const sortDimsByFactors = (dimInstances) => {
  const sorted = [];
  const deployDims = filterDimInstancesByPhase('deploy', dimInstances);
  const activityDims = filterDimInstancesByPhase('activity', dimInstances);
  const arriveDims = filterDimInstancesByPhase('arrive', dimInstances);
  const assignDims = filterDimInstancesByPhase('assign', dimInstances);
  const completeDims = filterDimInstancesByPhase('complete', dimInstances);

  sortAndAddDimInstances(sorted, deployDims);
  sortAndAddDimInstances(sorted, activityDims);
  sortAndAddDimInstances(sorted, arriveDims);
  sortAndAddDimInstances(sorted, assignDims);
  sortAndAddDimInstances(sorted, completeDims);
  return sorted;
}

const sortAndAddDimInstances = (sorted, dimInstances) => {
  let itemWasAdded;
  let addedCnt = 0;
  do {
    itemWasAdded = false;
    dimInstances.forEach(dim => {
      if (!inSorted(sorted, dim) && hasAllDependencies(sorted, dim)) {
        sorted.push(dim);
        itemWasAdded = true;
        addedCnt += 1;
      }
    })
  } while (itemWasAdded);
  if (addedCnt === dimInstances.length)
    return;
  throw new Error(`dimensions influences contain a circular or missing dependency`);
};

export const filterDimInstances = (valuesDescriptor, dimInstances) => {
  const { entity, phase } = valuesDescriptor;
  const dimsByEntity = filterDimInstancesByEntity(entity, dimInstances);
  return filterDimInstancesByPhase(phase, dimsByEntity);
};

export const filterDimInstancesByPhase = (phase, dimInstances) => {
  const filtered = R.filter(
    inst => inst.phase === phase,
    dimInstances
  );
  return filtered;
};

export const filterDimInstancesByEntity = (entity, dimInstances) => {
  const filtered = R.filter(
    inst => inst.entity === entity,
    dimInstances
  );
  return filtered;
};

const inSorted = (sorted, dim) => R.any(p => p.instName === dim.instName, sorted);

const hasAllDependencies = (sorted, dim) => {
  const dependencyNames = getFactorInstNames(dim.influences);
  return R.all(instNameInDimList(sorted), dependencyNames);
};

const getFactorInstNames = (influences) => {
  const factors = influences.map(R.prop('factor'));
  const instNames = factors.map(f => {
    const [_dimName, instName] = f.split('.');
    return instName;
  })
  return instNames;
};

const instNameInDimList = R.curry((dimensions, instName) => {
  return R.any(p => p.instName === instName, dimensions);
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
