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

export const getPropValues = (ctx, valuesDescriptor) => {
  const { propInstances, propValues } = ctx;
  const entPropInstances = filterPropInstancesByEntity(valuesDescriptor.entity, propInstances);
  const values = R.reduce(
    getAndAccumValue(propValues, valuesDescriptor.id),
    {},
    entPropInstances
  );
  return values;
};

export const getAttributes = (ctx, valuesDescriptor) => {
  const { propInstances, propValues } = ctx;
  const attrPropInstances = filterPropInstancesByEntity(valuesDescriptor.entity, propInstances)
    .filter(propAndInst => propAndInst.isAttribute);
  const attributes = R.reduce(
    getAndAccumValue(propValues, valuesDescriptor.id),
    {},
    attrPropInstances
  );
  return attributes;
};

const getAndAccumValue = R.curry((propValues, id, accum, propAndInst) => {
  const { entity, instName } = propAndInst;
  const keyPath = R.split('.', instName);
  const valuePath = R.concat([entity, id], keyPath);
  const value = R.path(valuePath, propValues);
  return R.assocPath(keyPath, value, accum);
});

export const getPropValue = (propValues, id, propAndInst) => {
  const { entity, instName } = propAndInst;
  const keyPath = R.split('.', instName);
  const valuePath = R.concat([entity, id], keyPath);
  const value = R.path(valuePath, propValues);
  return value;
};

export const hasAttributeValue = R.curry((key, val, obj) => obj.attributes[key] === val);

export const sortPropsByFactors = (propInstances) => {
  const sorted = [];
  const deployProps = filterPropInstancesByPhase('deploy', propInstances);
  const activityProps = filterPropInstancesByPhase('activity', propInstances);
  const arriveProps = filterPropInstancesByPhase('arrive', propInstances);
  const assignProps = filterPropInstancesByPhase('assign', propInstances);
  const completeProps = filterPropInstancesByPhase('complete', propInstances);

  sortAndAddPropInstances(sorted, deployProps);
  sortAndAddPropInstances(sorted, activityProps);
  sortAndAddPropInstances(sorted, arriveProps);
  sortAndAddPropInstances(sorted, assignProps);
  sortAndAddPropInstances(sorted, completeProps);
  return sorted;
}

const sortAndAddPropInstances = (sorted, propInstances) => {
  let itemWasAdded;
  let addedCnt = 0;
  do {
    itemWasAdded = false;
    propInstances.forEach(prop => {
      if (!inSorted(sorted, prop) && hasAllDependencies(sorted, prop)) {
        sorted.push(prop);
        itemWasAdded = true;
        addedCnt += 1;
      }
    })
  } while (itemWasAdded);
  if (addedCnt === propInstances.length)
    return;
  throw new Error(`props influences contain a circular or missing dependency`);
};

export const filterPropInstances = (valuesDescriptor, propInstances) => {
  const { entity, phase } = valuesDescriptor;
  const propsByEntity = filterPropInstancesByEntity(entity, propInstances);
  return filterPropInstancesByPhase(phase, propsByEntity);
};

export const filterPropInstancesByPhase = (phase, propInstances) => {
  const filtered = R.filter(
    inst => inst.phase === phase,
    propInstances
  );
  return filtered;
};

export const filterPropInstancesByEntity = (entity, propInstances) => {
  const filtered = R.filter(
    inst => inst.entity === entity,
    propInstances
  );
  return filtered;
};

const inSorted = (sorted, prop) => R.any(p => p.instName === prop.instName, sorted);

const hasAllDependencies = (sorted, prop) => {
  const dependencyNames = getFactorInstNames(prop.influences);
  return R.all(instNameInPropList(sorted), dependencyNames);
};

const getFactorInstNames = (influences) => {
  const factors = influences.map(R.prop('factor'));
  const instNames = factors.map(f => {
    const [_propName, instName] = f.split('.');
    return instName;
  })
  return instNames;
};

const instNameInPropList = R.curry((props, instName) => {
  return R.any(p => p.instName === instName, props);
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
