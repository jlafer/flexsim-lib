import * as R from 'ramda';
const seedrandom = require('seedrandom');

import { calcDimsValues } from './calcs';
import { getDimInstances, getSingleDimInstance, requiredPropNames } from './schema';
import { findObjInList, localeToFakerModule, filterDimInstancesByEntity } from './util';

export function genConfiguration(domain, locale, seed) {
  const args = { locale, seed };
  const context = { args, domain };
  const cfg = {};
  cfg.metadata = R.pick(requiredPropNames, context.domain);
  context.cfg = cfg;
  context.dimInstances = getDimInstances(cfg.metadata.dimensions);
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

function genQueues(context) {
  const { cfg, dimInstances } = context;
  const { metadata } = cfg;
  const { queueWorkerDims } = metadata;
  const queueDimName = queueWorkerDims[0];
  const workerAttributes = filterDimInstancesByEntity('workers', dimInstances);
  const dimAndInst = workerAttributes.find(a => a.instName === queueDimName);
  const { valueCnt, values } = dimAndInst;
  const queues = values.map(dimToQueue(queueDimName, valueCnt));
  return queues;
}

const genWorkflow = (context) => {
  const { cfg, dimInstances } = context;
  const { metadata } = cfg;
  const { brand, queueFilterDim: filterDimName } = metadata;
  const dimAndInst = findObjInList('instName', filterDimName, dimInstances);
  const filters = dimAndInst.values.map(dimToFilter(filterDimName));
  const workflow = {
    friendlyName: `${brand} Workflow`,
    configuration: {
      task_routing: {
        filters,
        default_filter: { queue: 'Everyone' }
      }
    }
  }
  return workflow;
};

const dimToQueue = (attrName, valueCnt) =>
  (attrValue) => {
    const expr = (valueCnt === 1)
      ? `${attrName} == '${attrValue}'`
      : `${attrName} HAS '${attrValue}'`;
    const data = {
      targetWorkers: expr,
      friendlyName: attrValue
    }
    return data;
  }

const dimToFilter = (attrName) =>
  (attrValue) => {
    const targets = [{
      queue: attrValue,
      timeout: 300
    }];
    return {
      filter_friendly_name: `${attrValue} Filter`,
      expression: `${attrName}=='${attrValue}'`,
      targets
    };
  };

const makeWorker = (i, context) => {
  const { args, cfg, dimInstances } = context;
  const { locale } = args;
  const { metadata } = cfg;
  const agtNum = `${i}`.padStart(3, '0');
  const friendlyName = `Agent_${agtNum}`;
  const fakerModule = localeToFakerModule(locale);
  const full_name = fakerModule.person.fullName();
  const valuesDescriptor = { entity: 'workers', phase: 'deploy', id: full_name };
  let customAttrs = calcDimsValues(context, valuesDescriptor);
  if (R.hasPath(['routing', 'skills'], customAttrs)) {
    customAttrs = R.assocPath(['routing', 'levels'], {}, customAttrs);
  }
  const attributes = {
    flexsim: metadata.brand,
    contact_uri: `client:${friendlyName}`,
    full_name,
    ...customAttrs
  };
  const channelDimInstance = getSingleDimInstance('channel', dimInstances);
  const { values, valueParams } = channelDimInstance;
  const channelCaps = R.zipWith(makeChannelCapacity, values, valueParams);
  return { friendlyName, attributes, channelCaps };
};

const makeChannelCapacity = (channelName, valueParam) =>
  ({ name: channelName, capacity: valueParam.baseCapacity });
