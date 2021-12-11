const path = require('path');
const fs = require('fs');

const CONFIG_PATH = 'config/content-security-policy.js';
const CSP_META_TAG_REG_EXP = /<meta http-equiv="Content-Security-Policy" content="(.*)">/i;

function parseExpressions(config) {
  return config.replace(/"{{.*}}"/gs, (match) =>
    match.replace(/"{{|}}"/g, '').replace(/\\"/g, '"')
  );
}

async function setConfig(testProject, config) {
  let content = `module.exports = function(environment) { return ${parseExpressions(
    JSON.stringify(config)
  )}; }`;

  await testProject.writeFile(CONFIG_PATH, content);
}

async function removeConfig(testProject) {
  try {
    await testProject.deleteFile(CONFIG_PATH);
  } catch (error) {
    // should silently ignore if config file does not exist
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function extractRunTimeConfig(html) {
  let encodedConfig = html.match(
    /<meta name="\S*\/config\/environment" content="(.*)" \/>/
  )[1];
  return JSON.parse(decodeURIComponent(encodedConfig));
}

async function readPackageJson(testProject) {
  return JSON.parse(await testProject.readFile('package.json'));
}

function getWorkspachePackageJson(testProject) {
  const workspaceRoot = path.join(testProject.path, '..', '..');
  return path.join(workspaceRoot, 'package.json');
}

function readWorkspacePackageJson(testProject) {
  return JSON.parse(
    fs.readFileSync(getWorkspachePackageJson(testProject), {
      encoding: 'utf-8',
    })
  );
}

function writeWorkspacePackageJson(testProject, content) {
  fs.writeFileSync(
    getWorkspachePackageJson(testProject),
    JSON.stringify(content)
  );
}

async function setResolutionForDependency(testProject, resolutions) {
  // resolutions must be defined in package.json at workspace root
  const packageJson = readWorkspacePackageJson(testProject);

  if (!packageJson.resolutions) {
    packageJson.resolutions = {};
  }
  Object.assign(packageJson.resolutions, resolutions);

  writeWorkspacePackageJson(testProject, packageJson);
}

async function removeResolutionsForDependencies(testProject) {
  const packageJson = readWorkspacePackageJson(testProject);

  delete packageJson.resolutions;

  writeWorkspacePackageJson(testProject, packageJson);
}

module.exports = {
  CSP_META_TAG_REG_EXP,
  extractRunTimeConfig,
  readPackageJson,
  removeConfig,
  removeResolutionsForDependencies,
  setConfig,
  setResolutionForDependency,
};
