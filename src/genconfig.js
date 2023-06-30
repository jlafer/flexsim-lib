import * as R from 'ramda';
const seedrandom = require('seedrandom');

import { calcPropsValues } from './calcs';
import { getPropInstances, getSinglePropInstance } from './schema';
import { findObjInList, localeToFakerModule, filterPropInstancesByEntity } from './util';

export function genConfiguration(domain, locale, seed) {
  const args = { locale, seed };
  const context = { args, domain };
  const cfg = {};
  cfg.metadata = R.pick(
    ['brand', 'agentCnt', 'queueFilterProp', 'queueWorkerProps', 'props'],
    context.domain
  );
  context.cfg = cfg;
  context.propInstances = getPropInstances(cfg.metadata.props);
  context.propValues = { workers: {}, tasks: {} }
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
  const { cfg, propInstances } = context;
  const { metadata } = cfg;
  const { queueWorkerProps } = metadata;
  const queuePropName = queueWorkerProps[0];
  const workerAttributes = filterPropInstancesByEntity('workers', propInstances);
  const propAndInst = workerAttributes.find(a => a.instName === queuePropName);
  const { valueCnt, values } = propAndInst;
  const queues = values.map(propToQueue(queuePropName, valueCnt));
  return queues;
}

const genWorkflow = (context) => {
  const { cfg, propInstances } = context;
  const { metadata } = cfg;
  const { brand, queueFilterProp: filterPropName } = metadata;
  const propAndInst = findObjInList('instName', filterPropName, propInstances);
  const filters = propAndInst.values.map(propToFilter(filterPropName));
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

const propToQueue = (attrName, valueCnt) =>
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

const propToFilter = (attrName) =>
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
  const { args, cfg, propInstances } = context;
  const { locale } = args;
  const { metadata } = cfg;
  const agtNum = `${i}`.padStart(3, '0');
  const friendlyName = `Agent_${agtNum}`;
  const fakerModule = localeToFakerModule(locale);
  const full_name = fakerModule.person.fullName();
  const valuesDescriptor = { entity: 'workers', phase: 'deploy', id: full_name };
  let customAttrs = calcPropsValues(context, valuesDescriptor);
  if (R.hasPath(['routing', 'skills'], customAttrs)) {
    customAttrs = R.assocPath(['routing', 'levels'], {}, customAttrs);
  }
  const attributes = {
    flexsim: metadata.brand,
    contact_uri: `client:${friendlyName}`,
    full_name,
    ...customAttrs
  };
  const channelPropInstance = getSinglePropInstance('channel', propInstances);
  const { values, valueProps } = channelPropInstance;
  const channelCaps = R.zipWith(makeChannelCapacity, values, valueProps);
  return { friendlyName, attributes, channelCaps };
};

const makeChannelCapacity = (channelName, valueProp) =>
  ({ name: channelName, capacity: valueProp.baseCapacity });
