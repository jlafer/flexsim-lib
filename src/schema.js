//import Ajv from 'ajv';
import * as R from 'ramda';
const Ajv = require('ajv')
import { findObjInList, sortDimsByFactors, sumValuesForKey } from './util';

const schema = {
  $id: 'http://twilio.com/schemas/flexsim/domain.json',
  type: 'object',
  properties: {
    brand: { type: 'string' },
    agentCnt: { type: 'integer' },
    queueFilterDim: { type: 'string' },
    queueWorkerDims: {
      type: 'array',
      items: { type: 'string' }
    },
    center: {
      type: 'object',
      properties: {
        'country': { type: 'string', minLength: 2, maxLength: 2 },
        'state': { type: 'string', minLength: 2, maxLength: 4 },
        'city': { type: 'string' },
        'zip': { type: 'string' },
        'ivrVoice': { type: 'string' },
        'agentVoice': { type: 'string' },
        'agentsPhone': { type: 'string', minLength: 10 }
      }
    },
    customers: {
      type: 'object',
      properties: {
        'country': { type: 'string', minLength: 2, maxLength: 2 },
        'phoneFormat': { type: 'string' },
        'customersPhone': { type: 'string', minLength: 10 },
        'voice': { type: 'string' },
      }
    },
    dimensions: {
      type: 'object',
      properties: {
        abandonTime: { $ref: 'dimDefn.json#/definitions/dimDefn' },
        activity: { $ref: 'dimDefn.json#/definitions/dimDefn' },
        arrivalGap: { $ref: 'dimDefn.json#/definitions/dimDefn' },
        channel: { $ref: 'dimDefn.json#/definitions/dimDefn' },
        talkTime: { $ref: 'dimDefn.json#/definitions/dimDefn' },
        waitTime: { $ref: 'dimDefn.json#/definitions/dimDefn' },
        wrapTime: { $ref: 'dimDefn.json#/definitions/dimDefn' }
      },
      additionalProperties: true
    }
  },
  additionalProperties: false
};

const dimDefnSchema = {
  $id: 'http://twilio.com/schemas/flexsim/dimDefn.json',
  definitions: {
    dimDefn: {
      type: 'object',
      properties: {
        dataType: {
          type: 'string',
          enum: ['boolean', 'integer', 'number', 'string'],
          default: 'string'
        },
        expr: {
          type: 'string',
          enum: ['enum', 'range'],
          default: 'enum'
        },
        min: { type: 'number' },
        max: { type: 'number' },
        values: {
          type: 'array',
          items: { type: 'string' }
        },
        instances: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entity: {
                type: 'string',
                enum: ['tasks', 'workers'],
                default: 'tasks'
              },
              instName: { type: 'string' },
              phase: {
                type: 'string',
                enum: ['deploy', 'activity', 'arrive', 'assign', 'complete']
              },
              isAttribute: { type: 'boolean' },
              curve: {
                type: 'string',
                enum: ['uniform', 'bell'],
                default: 'uniform'
              },
              valueCnt: {
                type: 'integer',
                default: 1
              },
              valueParams: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    portion: { type: 'number' }
                  }
                }
              },
              influences: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    factor: { type: 'string' },
                    effect: {
                      type: 'string',
                      enum: ['shift', 'skew', 'focus'],
                      default: 'shift'
                    },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

export const requiredPropNames = [
  'brand', 'agentCnt', 'center', 'customers', 'queueFilterDim', 'queueWorkerDims', 'dimensions'
];

const stdDimNames = [
  'abandonTime', 'activity', 'arrivalGap', 'channel', 'talkTime', 'waitTime', 'wrapTime'
];

const requiredDimProps = [
  'name', 'dataType', 'expr', 'min', 'max', 'instances'
];

const requiredInstanceProps = [
  'instName', 'entity', 'phase', 'isAttribute', 'curve', 'valueCnt'
];

export const checkAndFillDomain = (defaults, domain) => {
  const ajv = new Ajv({ useDefaults: true });
  const validate = ajv.addSchema(dimDefnSchema).compile(schema);

  // NOTE: ajv's validate mutates defaults and domain by filling default values
  let valid = validate(defaults);
  if (!valid) {
    console.log('ERROR: invalid locale file contents; please contact the project owners');
    return [valid, validate.errors];
  }

  if (!!domain) {
    valid = validate(domain);
    if (!valid) {
      console.log('ERROR: invalid domain.json file contents');
      return [valid, validate.errors];
    }
  }

  const merged = (!!domain)
    ? mergeDomainIntoDefaults(defaults, domain)
    : defaults;
  const res = checkAndFill(merged);
  return [true, res];
}

const mergeDomainIntoDefaults = (defaults, domain) => {
  const { dimensions: defaultDims, ...defaultProps } = defaults;
  const { dimensions: domainDims, ...domainProps } = domain;

  // first, merge the parameters (except 'dimensions')
  const finalProps = R.mergeRight(defaultProps, domainProps);

  // next, remove any non-standard dimensions from the defaults
  // if the domain file specifies any non-standard dimensions
  const nonStdDomainDims = getNonStdDims(domainDims);
  const finalDefaultDims = (R.isEmpty(nonStdDomainDims))
    ? defaultDims
    : getStdDims(defaultDims);

  const finalDims = R.mergeDeepRight(finalDefaultDims, domainDims);
  const finalDomain = { ...finalProps, dimensions: finalDims };
  return finalDomain;
};

const checkAndFill = (domain) => {
  const { dimensions, ...parameters } = domain;

  //convert dimensions to an array-of-objs for ease-of-use in the rest of flexsim
  const dimsArr = objDictToObjArr('name', dimensions);
  const finalDomain = { ...parameters, dimensions: dimsArr };

  fillDomain(finalDomain);
  checkDomain(finalDomain);

  return finalDomain;
};

const fillDomain = (domain) => {
  const { dimensions, ...parameters } = domain;
  dimensions.forEach(fillMissingDimFields);
  const waitTimeDim = findObjInList('name', 'waitTime', dimensions);
  if (!!waitTimeDim)
    waitTimeDim.instances[0].hasManualCalculation = true;
};

function fillMissingDimFields(dim) {
  const { instances } = dim;
  if (!dim.expr)
    dim.expr = 'enum';
  if (!dim.dataType)
    dim.dataType = 'string';
  if (!dim.min)
    dim.min = 0;
  if (!dim.max)
    dim.max = 1;
  if (instances)
    instances.forEach(fillMissingInstanceFields(dim));
}

const fillMissingInstanceFields = (dim) =>
  inst => {
    if (!inst.instName)
      inst.instName = dim.name;
    if (inst.isAttribute == undefined)
      inst.isAttribute = true;
    if (!inst.influences)
      inst.influences = [];
    if (!inst.entity)
      inst.entity = 'tasks';
    if (inst.entity === 'tasks' && !inst.phase)
      inst.phase = 'arrive';
    if (inst.entity === 'workers' && !inst.phase)
      inst.phase = 'deploy';
    if (!inst.curve)
      inst.curve = (dim.expr === 'enum') ? 'uniform' : 'bell';
    if (!inst.valueCnt)
      inst.valueCnt = 1;
    if (dim.expr === 'enum' && !inst.valueParams)
      inst.valueParams = buildDefaultValueParams(dim.values);
  }

export const checkDomain = (domain) => {
  const propNames = R.keys(domain);
  const missingProps = R.difference(requiredPropNames, propNames);
  if (missingProps.length > 0)
    throwConfigError(`missing domain parameters: ${missingProps.join(', ')}`);

  const { dimensions, ...parameters } = domain;

  const { center, customers } = parameters;
  // TODO what checks are needed on center, customers dims?

  const dimNames = R.pluck('name', dimensions);
  const missingDims = R.difference(stdDimNames, dimNames);
  if (missingDims.length > 0)
    throwConfigError(`missing standard dimensions: ${missingDims.join(', ')}`);

  dimensions.forEach(checkDimFields);
};

const checkDimFields = (dim) => {
  const { name, dataType, expr, values, instances } = dim;
  const dimDimNames = R.keys(dim);
  const missingDimProps = R.difference(requiredDimProps, dimDimNames);
  if (missingDimProps.length > 0)
    throwConfigError(`dim -${name} is missing properties: ${missingPropProps.join(', ')}`);
  if (!['boolean', 'integer', 'number', 'string'].includes(dataType))
    throwConfigError(`property ${name} has invalid dataType ${dataType}`);
  if (!['enum', 'range'].includes(expr))
    throwConfigError(`property ${name} has invalid expr ${expr}`);
  if (expr === 'enum' && (!values || values.length === 0))
    throwConfigError(`property ${name} has expr=enum but no values specified`);
  instances.forEach(checkInstanceFields(dim));
};

const checkInstanceFields = (dim) => {
  const { name } = dim;
  return (inst) => {
    const { entity, phase, curve, valueParams } = inst;
    const instanceProps = R.keys(inst);
    const missingInstanceProps = R.difference(requiredInstanceProps, instanceProps);
    if (missingInstanceProps.length > 0)
      throwConfigError(`dim -${name} is missing properties: ${missingInstanceProps.join(', ')}`);
    if (!['tasks', 'workers'].includes(entity))
      throwConfigError(`dim ${name} has instance with invalid entity ${entity}`);
    if (!['deploy', 'activity', 'arrive', 'assign', 'complete'].includes(phase))
      throwConfigError(`dim ${name} has instance with invalid phase ${phase}`);
    if (!['uniform', 'bell'].includes(curve))
      throwConfigError(`dim ${name} has instance with invalid curve ${curve}`);
    if (dim.expr === 'enum' && !valueParams)
      throwConfigError(`dim ${name} has instance with no valueParams specified`);
    if (dim.expr === 'enum')
      checkValueParams(name, valueParams);
  }
}

const buildDefaultValueParams = (values) => {
  const valueCnt = values.length;
  if (valueCnt === 0)
    return [];
  const equalPortion = Math.floor(100 / valueCnt);
  const gap = 100 - (equalPortion * valueCnt);
  const valueParams = R.map(_value => ({ portion: equalPortion / 100 }), values);
  valueParams[0].portion += (gap / 100);
  return valueParams;
};

const objDictToObjArr = (key, dictByName) => {
  const arr = R.toPairs(dictByName)
    .map(([name, dim]) => ({ ...dim, [key]: name }));
  return arr;
};

const checkValueParams = (name, valueParams) => {
  const sum = sumValuesForKey('portion', valueParams);
  if (sum < 0.99 || sum > 1.01)
    throwConfigError(`property ${name} has instance with valueParams not summing to 1`);
};

const filterStdDims = ([name, _dim]) => stdDimNames.includes(name);
const filterNonStdDims = R.complement(filterStdDims);

function getNonStdDims(dimensions) {
  const nonStdDimPairs = R.toPairs(dimensions)
    .filter(filterNonStdDims);
  return R.fromPairs(nonStdDimPairs);
}

function getStdDims(dimensions) {
  const stdDimPairs = R.toPairs(dimensions)
    .filter(filterStdDims);
  return R.fromPairs(stdDimPairs);
}

export const getDimInstances = (dimensions) => {
  const tgtDimInstances = R.reduce(
    (accum, testDim) => {
      if (testDim.instances.length > 0) {
        const { instances, ...restOfDim } = testDim;
        const dimAndInstArr = R.map(
          (inst) => {
            const dimAndInst = { ...restOfDim, ...inst };
            return dimAndInst;
          },
          testDim.instances
        );
        return [...accum, ...dimAndInstArr];
      }
      return accum
    },
    [],
    dimensions
  );
  return sortDimsByFactors(tgtDimInstances);
};

export const getSingleDimInstance = (name, dimInstances) =>
  findObjInList('instName', name, dimInstances);

const throwConfigError = (msg) => {
  console.error(`ERROR: ${msg}`);
  throw new Error(msg);
};
