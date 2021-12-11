const expect = require('chai').expect;
const TestProject = require('ember-addon-tests').default;
const { removeConfig, setConfig } = require('../utils');
const path = require('path');

describe('e2e: CLI command csp-headers', function () {
  this.timeout(300000);

  let testProject;

  before(async function () {
    testProject = new TestProject({
      projectRoot: path.join(__dirname, '../..'),
    });

    await testProject.createEmberApp();
    await testProject.addOwnPackageAsDevDependency(
      'ember-cli-content-security-policy'
    );
  });

  afterEach(async function () {
    await removeConfig(testProject);
  });

  it('returns CSP on stdout', async function () {
    await setConfig(testProject, {
      policy: {
        'default-src': "'self'",
        'script-src': "'self' 'unsafe-inline'",
      },
    });

    let { stdout } = await testProject.runEmberCommand(
      'csp-headers',
      '--silent'
    );
    expect(stdout).to.equal(
      "default-src 'self'; script-src 'self' 'unsafe-inline';"
    );
  });

  it('passes environment into the configuration', async function () {
    await setConfig(testProject, {
      policy: {
        'default-src': "'self'",
        'script-src':
          "{{\"'self'\" + environment === 'development' ? \" 'unsafe-inline'\" : ''}}",
      },
    });

    let { stdout } = await testProject.runEmberCommand(
      'csp-headers',
      '--silent'
    );
    expect(stdout).to.equal(
      "default-src 'self'; script-src 'self' 'unsafe-inline';"
    );

    // let { stdout } = await testProject.runEmberCommand(
    //   'csp-headers',
    //   '--silent',
    //   '--evironment=production'
    // );
    // expect(stdout).to.equal(
    //   "default-src 'self'; script-src 'self';"
    // );
  });
});
