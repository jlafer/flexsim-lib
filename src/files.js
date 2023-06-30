import fs from 'fs';

function readTextFile(path) {
  return new Promise(function (resolve, reject) {
    fs.readFile(path, 'utf8',
      function (err, text) {
        if (err) reject(err);
        resolve(text);
      }
    );
  });
}

function writeToTextFile(path, str) {
  return new Promise(function (resolve, reject) {
    fs.writeFile(path, str,
      function (err) {
        if (err) reject(err);
        resolve(null);
      }
    );
  });
}

export function readJsonFile(path) {
  return readTextFile(path)
    .then(function (text) {
      return new Promise(function (resolve, reject) {
        let data;
        try {
          data = JSON.parse(text);
        }
        catch (err) {
          reject(err);
        }
        resolve(data);
      });
    })
}

export function writeToJsonFile(path, value) {
  const str = JSON.stringify(value, null, 2);
  return writeToTextFile(path, str);
}

export async function writeCfgToCfgdir(cfgdir, cfg) {
  const {
    metadata, queues, workers, workflow
  } = cfg;
  let path;
  path = `${cfgdir}/metadata.json`;
  await writeToJsonFile(path, metadata);
  path = `${cfgdir}/workflow.json`;
  await writeToJsonFile(path, workflow);
  path = `${cfgdir}/workers.json`;
  await writeToJsonFile(path, workers);
  path = `${cfgdir}/queues.json`;
  await writeToJsonFile(path, queues);
}
