const expect = require('chai').expect;
const TestProject = require('ember-addon-tests').default;
const denodeify = require('denodeify');
const request = denodeify(require('request'));
const path = require('path');
const { extractRunTimeConfig } = require('../utils');

describe('e2e: fastboot integration if consumer does not use FastBoot', function() {
  this.timeout(300000);

  let testProject;

  before(async function() {
    testProject = new TestProject({
      projectRoot: path.join(__dirname, '../..')
    });

    await testProject.createEmberApp();
    await testProject.addOwnPackageAsDevDependency('ember-cli-content-security-policy');
    await testProject.startEmberServer({
      port: '49741',
    });
  });

  after(async function() {
    await testProject.stopEmberServer();
  });

  it('does not push run-time configuration into app if app does not use FastBoot', async function() {
    let response = await request({
      url: 'http://localhost:49741',
      headers: {
        'Accept': 'text/html'
      }
    });

    expect(response.statusCode).to.equal(200);

    let runTimeConfig = extractRunTimeConfig(response.body);
    expect(runTimeConfig).to.not.include.key('ember-cli-content-security-policy');
  });
});
