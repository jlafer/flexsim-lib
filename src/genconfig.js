import * as R from 'ramda';
const seedrandom = require('seedrandom');

import { calcDimsValues } from './calcs';
import { getDimension, requiredPropNames } from './schema';
import { findObjInList, localeToFakerModule } from './util';

export function genConfiguration(domain, locale, seed) {
  const args = { locale, seed };
  const context = { args, domain };
  const cfg = {};
  cfg.metadata = R.pick(requiredPropNames, context.domain);
  context.cfg = cfg;
  context.dimValues = { workers: {}, tasks: {} }
  context.rng = seedrandom(args.seed);
  cfg.workers = genWorkers(context);
  cfg.queues = genQueues(context);
  cfg.workflow = genWorkflow(context);
  return cfg;
}

function genWorkers(context) {
  const { cfg } = context;
  const { metadata } = cfg;
  const { agentCnt } = metadata;
  const workers = [];
  for (let i = 0; i < agentCnt; i++) {
    const data = makeWorker(i, context);
    workers.push(data);
  }
  return workers;
}

// TODO review this logic
// also, it only supports a single dim in queue worker expression
// and tht dimension cannot have a parent dimension

function genQueues(context) {
  const { cfg } = context;
  const { metadata } = cfg;
  const { queueWorkerDims } = metadata;

  // for now, only use the first worker dim
  const workerDimName = queueWorkerDims[0];
  const workerQueueDim = getDimension(workerDimName, context);
  const { parent, valueCnt, options, attrName } = workerQueueDim;

  const workerAttrName = attrName || workerDimName;
  let queues = [];

  if (!parent)
    queues = addQueuesForOptions(workerAttrName, valueCnt, options.all);
  else {
    const parentOptions = R.keys(options);
    parentOptions.forEach(parentOption => {
      queues = R.concat(
        queues,
        addQueuesForOptions(workerAttrName, valueCnt, options[parentOption])
      );
    });
  }
  return queues;
}

const genWorkflow = (context) => {
  const { cfg } = context;
  const { metadata } = cfg;
  const { brand, queueFilterDim: filterDimName } = metadata;

  const dim = getDimension(filterDimName, context);
  const { parent, options } = dim;

  let filters = [];

  if (!parent)
    filters = options.all.map(dimOptionToFilter(filterDimName));
  else {
    const parentOptions = R.keys(options);
    parentOptions.forEach(parentOption => {
      filters = R.concat(
        queues,
        addFiltersForOptions(filterDimName, options[parentOption])
      );
    });
  }
  const workflow = {
    friendlyName: `${brand} Workflow`,
    configuration: {
      task_routing: {
        filters,
        default_filter: { queue: 'Everyone' }
      }
    }
  };
  return workflow;
};

const addQueuesForOptions = (workerAttrName, valueCnt, optionValues) => {
  return optionValues.map(dimOptionToQueue(workerAttrName, valueCnt));
}

const dimOptionToQueue = (attrName, valueCnt) =>
  (dimOption) => {
    const expr = (valueCnt === 1)
      ? `${attrName} == '${dimOption}'`
      : `${attrName} HAS '${dimOption}'`;
    const data = {
      targetWorkers: expr,
      friendlyName: dimOption
    }
    return data;
  }

const addFiltersForOptions = (filterDimName, optionValues) => {
  return optionValues.map(dimOptionToFilter(filterDimName));
};

const dimOptionToFilter = (dimName) =>
  (dimOption) => {
    const targets = [{
      queue: dimOption,
      timeout: 300
    }];
    return {
      filter_friendly_name: `${dimOption} Filter`,
      expression: `${dimName}=='${dimOption}'`,
      targets
    };
  };

const makeWorker = (i, context) => {
  const { args, cfg } = context;
  const { locale } = args;
  const { metadata } = cfg;
  const { dimensions } = metadata;

  const agtNum = `${i}`.padStart(3, '0');
  const friendlyName = `Agent_${agtNum}`;
  const fakerModule = localeToFakerModule(locale);
  const full_name = `${fakerModule.person.firstName()} ${fakerModule.person.lastName()}`;
  const valuesDescriptor = { entity: 'workers', phase: 'deploy', id: full_name };
  const workerDimValues = calcDimsValues(context, valuesDescriptor);
  let customAttrs = dimValuesToAttributes(context, workerDimValues);

  // if TR sees 'routing.skills'
  if (R.hasPath(['routing', 'skills'], customAttrs)) {
    // it expects to find 'routing.levels' so add it (empty)
    customAttrs = R.assocPath(['routing', 'levels'], {}, customAttrs);
  }
  const attributes = {
    flexsim: metadata.brand,
    contact_uri: `client:${friendlyName}`,
    full_name,
    ...customAttrs
  };
  const channelDim = findObjInList('name', 'channel', dimensions);
  const { options, optionParams } = channelDim;
  const channelCaps = R.zipWith(makeChannelCapacity, options, optionParams);
  return { friendlyName, attributes, channelCaps };
};

const makeChannelCapacity = (channelName, optionParam) =>
  ({ name: channelName, capacity: optionParam.baseCapacity });

const dimValuesToAttributes = (ctx, workerDimValues) => {
  let attributes = {};
  R.toPairs(workerDimValues).forEach(([dimName, dimValue]) => {
    const dim = getDimension(dimName, ctx);
    const attrName = dim.attrName || dim.name;
    const keyPath = R.split('.', attrName);
    attributes = R.assocPath(keyPath, dimValue, attributes)
  })
  return attributes;
};
