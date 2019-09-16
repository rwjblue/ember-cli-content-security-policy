const expect = require('chai').expect;
const AddonTestApp = require('ember-cli-addon-tests').AddonTestApp;
const fs = require('fs-extra');
const denodeify = require('denodeify');
const request = denodeify(require('request'));
const {
  removeConfig,
  setConfig
} = require('../utils');

describe('e2e: fastboot integration', function() {
  this.timeout(300000);

  let app;
  let serverProcess;
  let serverPromise;

  // code to start and stop fastboot app server is highly inspired by ember-cli-addon-tests
  // https://github.com/tomdale/ember-cli-addon-tests/blob/master/lib/commands/start-server.js
  function startServer() {
    return new Promise((resolve, reject) => {
      serverPromise = app.run('node', 'server.js', {
        onOutput(output, child) {
          // detect start of fastboot app server
          if (output.includes('HTTP server started')) {
            serverProcess = child;
            resolve();
          }
        },
      }).catch(reject);
    });
  }

  before(async function() {
    app = new AddonTestApp();

    await app.create('default', {
      noFixtures: true,
      skipNpm: true,
    });

    await app.editPackageJSON(pkg => {
      pkg.devDependencies['ember-cli-fastboot'] = "*";
      pkg.devDependencies['fastboot-app-server'] = "*";
    });

    await app.run('npm', 'install');

    // Quick Start instructions of FastBoot App Server
    // https://github.com/ember-fastboot/fastboot-app-server
    await fs.writeFile(app.filePath('server.js'),
      `
        const FastBootAppServer = require('fastboot-app-server');

        let server = new FastBootAppServer({
          distPath: 'dist',
          port: 49742,
        });

        server.start();
      `
    );
  });

  afterEach(async function() {
    // stop fastboot app server
    if (process.platform === 'win32') {
      serverProcess.send({ kill: true });
    } else {
      serverProcess.kill('SIGINT');
    }

    // wait until sever terminated
    await serverPromise;

    await removeConfig(app);
  });

  it('sets CSP header if served via FastBoot', async function() {
    await app.runEmberCommand('build');
    await startServer();

    let response = await request({
      url: 'http://localhost:49742',
      headers: {
        'Accept': 'text/html'
      },
    });

    expect(response.headers).to.include.key('content-security-policy-report-only');
  });

  it('does not set CSP header if disabled', async function() {
    await setConfig(app, { enabled: false });
    await app.runEmberCommand('build');
    await startServer();

    let response = await request({
      url: 'http://localhost:49742',
      headers: {
        'Accept': 'text/html'
      },
    });

    expect(response.headers).to.not.include.key('content-security-policy-report-only');
  });

  it('does not set CSP header if delivery does not include header', async function() {
    await setConfig(app, { delivery: ['meta'] });
    await app.runEmberCommand('build');
    await startServer();

    let response = await request({
      url: 'http://localhost:49742',
      headers: {
        'Accept': 'text/html'
      },
    });

    expect(response.headers).to.not.include.key('content-security-policy-report-only');
  });
});
