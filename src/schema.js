//import Ajv from 'ajv';
import * as R from 'ramda';
const Ajv = require('ajv')
import { findObjInList, getDimValue, sumValuesForKey } from './util';

const schema = {
  $id: 'http://twilio.com/schemas/flexsim/domain.json',
  type: 'object',
  properties: {
    brand: { type: 'string', default: 'FlexDemo' },
    agentCnt: { type: 'integer', default: 12 },
    realVoice: { type: 'boolean', default: false },
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
        parent: { type: 'string' },
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
        entity: {
          type: 'string',
          enum: ['tasks', 'workers'],
          default: 'tasks'
        },
        phase: {
          type: 'string',
          enum: ['deploy', 'activity', 'arrive', 'assign', 'complete']
        },
        isAttribute: { type: 'boolean' },
        min: { type: 'number' },
        max: { type: 'number' },
        options: { type: 'object' },
        curve: {
          type: 'string',
          enum: ['uniform', 'bell'],
          default: 'uniform'
        },
        valueCnt: {
          type: 'integer',
          default: 1
        },
        optionParams: { type: 'object' },
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
};

export const requiredPropNames = [
  'brand', 'agentCnt', 'center', 'customers', 'queueFilterDim', 'queueWorkerDims', 'realVoice', 'dimensions'
];

const stdDimNames = [
  'abandonTime', 'activity', 'arrivalGap', 'channel', 'talkTime', 'waitTime', 'wrapTime'
];

const requiredDimProps = [
  'name', 'curve', 'dataType', 'entity', 'expr', 'isAttribute', 'min', 'max', 'phase', 'valueCnt'
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

  // convert dimensions to an array-of-objs for ease-of-use in the rest of flexsim
  const dimsArr = objDictToObjArr('name', dimensions);

  const finalDomain = { ...parameters, dimensions: dimsArr };

  fillDomain(finalDomain);
  checkDomain(finalDomain);

  return finalDomain;
};

export const getDimension = (name, ctx) => {
  return findObjInList('name', name, ctx.cfg.metadata.dimensions);
};

export const getDimensionValue = (ctx, dimKey, valuekey) => {
  const { dimValues } = ctx;
  const dim = getDimension(dimKey, ctx);
  return getDimValue(dimValues, valuekey, dim);
};

const fillDomain = (domain) => {
  const { dimensions } = domain;
  dimensions.forEach(fillMissingDimFields);
  const waitTimeDim = findObjInList('name', 'waitTime', dimensions);
  if (!!waitTimeDim)
    waitTimeDim.hasManualCalculation = true;
};

function fillMissingDimFields(dim) {
  if (!dim.expr)
    dim.expr = 'enum';
  if (!dim.dataType)
    dim.dataType = 'string';
  if (!dim.min)
    dim.min = 0;
  if (!dim.max)
    dim.max = 1;
  if (dim.isAttribute == undefined)
    dim.isAttribute = true;
  if (!dim.influences)
    dim.influences = [];
  if (!dim.entity)
    dim.entity = 'tasks';
  if (dim.entity === 'tasks' && !dim.phase)
    dim.phase = 'arrive';
  if (dim.entity === 'workers' && !dim.phase)
    dim.phase = 'deploy';
  if (!dim.curve)
    dim.curve = (dim.expr === 'enum') ? 'uniform' : 'bell';
  if (!dim.valueCnt)
    dim.valueCnt = 1;
  if (dim.expr === 'enum' && !dim.optionParams) {
    dim.optionParams = buildDefaultOptionParams(dim);
  }
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
  const { name, dataType, expr, entity, parent, phase, curve, options, optionParams } = dim;
  const dimDimNames = R.keys(dim);
  const missingDimProps = R.difference(requiredDimProps, dimDimNames);
  if (missingDimProps.length > 0)
    throwConfigError(`dim -${name} is missing properties: ${missingDimProps.join(', ')}`);
  if (!['boolean', 'integer', 'number', 'string'].includes(dataType))
    throwConfigError(`property ${name} has invalid dataType ${dataType}`);
  if (!['enum', 'range'].includes(expr))
    throwConfigError(`property ${name} has invalid expr ${expr}`);
  if (expr === 'enum')
    checkEnumOptions(dim);
  if (!['tasks', 'workers'].includes(entity))
    throwConfigError(`dim ${name} has invalid entity ${entity}`);
  if (!['deploy', 'activity', 'arrive', 'assign', 'complete'].includes(phase))
    throwConfigError(`dim ${name} has invalid phase ${phase}`);
  if (!['uniform', 'bell'].includes(curve))
    throwConfigError(`dim ${name} has invalid curve ${curve}`);
  if (dim.expr === 'enum' && !optionParams)
    throwConfigError(`dim ${name} has no optionParams specified`);
  if (dim.expr === 'enum')
    checkEnumOptionParams(name, parent, options, optionParams);
};

export const checkEnumOptions = (dim) => {
  const { name, parent, options } = dim;

  if (!parent && (!options || !options.all))
    throwConfigError(`property ${name} has expr=enum but no options.all specified`);
  if (!!parent && (!options || R.keys(options).length === 0))
    throwConfigError(`property ${name} has expr=enum, with a parent dimension, but has no options specified`);
  return true;
}

const buildDefaultOptionParams = (dimension) => {
  const { options, parent } = dimension;

  const optionParams = {};
  if (!parent)
    optionParams.all = buildOptionParams(options.all);
  else {
    const parentOptions = R.keys(options);
    parentOptions.forEach(parentOption => {
      optionParams[parentOption] = buildOptionParams(options[parentOption]);
    });
  }
  return optionParams;
}

const buildOptionParams = (parentValOptions) => {
  const optionCnt = parentValOptions.length;
  if (optionCnt === 0)
    return [];
  const equalPortion = Math.floor(100 / optionCnt);
  const gap = 100 - (equalPortion * optionCnt);
  const optionParams = R.map(_option => ({ portion: equalPortion / 100 }), parentValOptions);
  optionParams[0].portion += (gap / 100);
  return optionParams;
};

const objDictToObjArr = (key, dictByName) => {
  const arr = R.toPairs(dictByName)
    .map(([name, dim]) => ({ ...dim, [key]: name }));
  return arr;
};

const checkEnumOptionParams = (name, parent, options, optionParams) => {
  if (!parent)
    checkOptionParams(name, 'all', options, optionParams);
  else {
    const parentOptions = R.keys(options);
    parentOptions.forEach(parentOption => {
      checkOptionParams(name, parentOption, options, optionParams);
    });
  }
};

const checkOptionParams = (dimName, parentOption, options, optionParams) => {
  const optionList = options[parentOption];
  const optionParamsList = optionParams[parentOption];
  if (!optionParamsList || optionParamsList.length === 0)
    throwConfigError(`property ${dimName} has no optionParams for parent option ${parentOption}`);
  if (optionList.length !== optionParamsList.length)
    throwConfigError(`property ${dimName} has optionParams not matching options for parent option ${parentOption}`);
  const sum = sumValuesForKey('portion', optionParamsList);
  if (sum < 0.99 || sum > 1.01)
    throwConfigError(`property ${dimName} has optionParams portions not summing to 1 for parent option ${parentOption}`);
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

const throwConfigError = (msg) => {
  console.error(`ERROR: ${msg}`);
  throw new Error(msg);
};
