# flexsim-lib

This is a NodeJS library for use with the `flexsim` runtime and editor.

## Installation
```
npm install flexsim-lib --save
```

## Usage
```
const { checkAndFillDomain, genConfiguration, readJsonFile, writeCfgToCfgdir } = require('flexsim-lib');
OR
import { checkAndFillDomain, genConfiguration, readJsonFile, writeCfgToCfgdir } from 'flexsim-lib';
```

## API

### checkAndFillDomain
```
checkAndFillDomain :: (defaults, custom) -> [isValid, filled]
```
This function combines a `defaults` domain object and a `custom` domain object for the `flexsim` simulator. It uses the custom object to enhance and/or override the default domain definition. First, it checks both objects for compliance with the flexsim domain schema. Next, it merges the custom object into the defaults according to rules described below. It then fills all missing domain definition values with reasonable defaults. Finally, it checks the resulting object for completeness and structural integrity.

It returns a 2-item array containing a boolean that indicates whether all of the schema validity checks passed and a result object. If the supplied objects form a valid domain definition when combined, the result object is the final domain object, which can be used to generate the flexsim configuration by calling `genConfiguration`. If the validity check fails, the result object contains error information.

The two objects are merged using a deep merge operation, which generally overrites any object keys in the defaults if supplied in the custom object. With the `dimensions` domain key there is an exceptioin to this rule; if any "non-standard" dimensions are supplied in the custom object, then all of the "non-standard" dimensions in the default are removed. For example, if the default object provides dimensions for "topic" and "language" but the custom object supplies dimensions for "LOB" and "product", then the merge will take place after the "topic" and "language" dimensions are removed.

For documentation on the domain schema, please see the README file in `flexsim`.

### readJsonFile
```
readJsonFile :: (path) -> Promise[data]
```
This function reads and parses a JSON-formatted file located at the supplied `path`. On success it returns a Promise that will resolve to a valid JavaScript object or array. If the path is invalid or the JSON doesn't parse correctly, it will throw an error.

### genConfiguration
```
genConfiguration :: (domain, locale, seed) -> config
```
This function takes a flexsim `domain` definition object and generates a flexsim configuration object. Names of agents are localized based on the `locale` string (e.g., "en-us", "es-sp"). For repeatable results, a `seed` string can seed the randomizer. If omitted, the randomization will result in differences every time the function is run. It returns a configuration object that can be written to the flexsim configuration files using `writeCfgToCfgdir`.

### writeCfgToCfgdir
```
writeCfgToCfgdir :: (cfgdir, config) -> undefined
```
This function takes a flexsim `config` object and writes the flexsim configuration files to the supplied `cfgdir` path. The files written are `metadata.json`, `queues.json`, `workers.json` and `workflow.json`. It returns a Promise that will resolve to `undefined` on success or an error if unable to write to the directory.

## Data Model
```
context = { dimValues, dimInstances, workers, queues, workflows }

// dimInstances are sorted so that every item comes after all of its calculation prereqs
dimInstances = [
  {..dimension, ...instance},
]

dimValues = {
  tasks: {                    // keyed by customer fullName
    {...dimValues,
      waitTime       // actual wait time
    }
  },
  workers: {}                 // workerAttributes, keyed by worker fullName
}
```

## Changelog
### 0.0.12
- This is the initial release. Some breaking changes are to be expected.
### 0.0.15
- This release is compatible with `flexsim` version 0.0.4.
- The terminology of the domain schema object properties was changed and clarified for better clarity. That is reflected in this document and the domain files.
- The following additions and changes have been made to the domain schema:
  - The `props` property has been renamed to `dimensions`.
  - The `valueProps` property within prop instances (now "dimension instances") has been renamed to `valueParams`.
  - New properties have been added: `center` and `customers`.
  - The `channel` dimension has been given a new value parameter property, `address`, which gives the phone number or "to" address that customers use to contact the center on that channel.
### 0.0.16
- The following additions and changes have been made to the domain schema:
  - The `customers` property object has been given a new key: `customersPhone`. This is a Twilio phone number used to simulate the speech of customers during phone calls. This phone must be provisioned in the target Twilio project.
  - The `center` property object has been given a new key: `agentsPhone`. This is a Twilio phone number used to simulate the speech of agents during phone calls. This phone must be provisioned in the target Twilio project.
### 0.0.17
- Added the getDimInstanceValue function.
