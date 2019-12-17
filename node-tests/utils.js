const fs = require('fs-extra');

const CSP_META_TAG_REG_EXP = /<meta http-equiv="Content-Security-Policy" content="(.*)">/i;

function getConfigPath(app) {
  return app.filePath('config/content-security-policy.js');
}

async function setConfig(app, config) {
  let file = getConfigPath(app);
  let content = `module.exports = function() { return ${JSON.stringify(config)}; }`;

  await fs.writeFile(file, content);
}

async function removeConfig(app) {
  let file = getConfigPath(app);

  if (!fs.existsSync(file)) {
    return;
  }

  await fs.remove(file);
}

module.exports = {
  CSP_META_TAG_REG_EXP,
  removeConfig,
  setConfig,
};
