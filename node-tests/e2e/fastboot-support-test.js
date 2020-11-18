const expect = require('chai').expect;
const TestProject = require('ember-addon-tests').default;
const fs = require('fs-extra');
const denodeify = require('denodeify');
const request = denodeify(require('request'));
const { extractRunTimeConfig, removeConfig, setConfig } = require('../utils');
const path = require('path');
const execa = require('execa');

describe('e2e: fastboot integration', function () {
  this.timeout(300000);

  let testProject;
  let serverProcess;

  // code to start and stop fastboot app server is highly inspired by ember-cli-addon-tests
  // https://github.com/tomdale/ember-cli-addon-tests/blob/master/lib/commands/start-server.js
  function startServer(server = 'server.js') {
    // start fastboot app server in child proces
    // can't use testProject.runCommand() cause that does not allow setting `{ all: true }`
    // option, which is required for reading output as a stream.
    serverProcess = execa('node', [server], {
      all: true,
      cwd: testProject.path,
    });

    // detect start of fastboot app server
    return new Promise((resolve, reject) => {
      let chunks = [];
      serverProcess.stdout.on('data', (chunk) => {
        // collect all chunks
        chunks.push(chunk);

        // parse stdout stream as string
        let receivedOutput = Buffer.concat(chunks).toString('utf8');

        // check stdout received so far for successful fastboot start message
        if (receivedOutput.includes('HTTP server started')) {
          resolve();
        }
      });

      serverProcess.catch(reject);
    });
  }

  async function stopServer() {
    // stop fastboot app server
    serverProcess.kill();

    // wait until sever terminated
    try {
      await serverProcess;
    } catch (error) {
      // expect serverProcess to reject due to being canceled
    }
  }

  before(async function () {
    testProject = new TestProject({
      projectRoot: path.join(__dirname, '../..'),
    });

    await testProject.createEmberApp();
    await testProject.addOwnPackageAsDevDependency(
      'ember-cli-content-security-policy'
    );
    await testProject.addDevDependency('ember-cli-fastboot');
    await testProject.addDevDependency('fastboot-app-server');

    // Quick Start instructions of FastBoot App Server
    // https://github.com/ember-fastboot/fastboot-app-server
    await testProject.writeFile(
      'server.js',
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

  describe('scenario: default', function () {
    before(async function () {
      await testProject.runEmberCommand('build');
      await startServer();
    });

    after(async function () {
      await stopServer();
      await removeConfig(testProject);
    });

    it('sets CSP header if served via FastBoot', async function () {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          Accept: 'text/html',
        },
      });

      expect(response.headers).to.include.key(
        'content-security-policy-report-only'
      );
    });
  });

  describe('scenario: disabled', function () {
    before(async function () {
      await setConfig(testProject, { enabled: false });
      await testProject.runEmberCommand('build');
      await startServer();
    });

    after(async function () {
      await stopServer();
      await removeConfig(testProject);
    });

    it('does not set CSP header if disabled', async function () {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          Accept: 'text/html',
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.not.include.key(
        'content-security-policy-report-only'
      );
    });

    it('does not push run-time configuration into app if disabled', async function () {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          Accept: 'text/html',
        },
      });

      let runTimeConfig = extractRunTimeConfig(response.body);
      expect(response.statusCode).to.equal(200);
      expect(runTimeConfig).to.not.include.key(
        'ember-cli-content-security-policy'
      );
    });

    it('does not push instance initializer into app if disabled', async function () {
      let response = await request({
        url: 'http://localhost:49742/assets/vendor.js',
        headers: {
          Accept: 'application/javascript',
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.not.include(
        'instance-initializers/content-security-policy'
      );
    });
  });

  describe('scenario: delivery does not include header', function () {
    before(async function () {
      await setConfig(testProject, { delivery: ['meta'] });
      await testProject.runEmberCommand('build');
      await startServer();
    });

    after(async function () {
      await stopServer();
      await removeConfig(testProject);
    });

    it('does not set CSP header if delivery does not include header', async function () {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          Accept: 'text/html',
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.not.include.key(
        'content-security-policy-report-only'
      );
    });

    it('does not push run-time configuration into app if delivery does not include header', async function () {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          Accept: 'text/html',
        },
      });

      let runTimeConfig = extractRunTimeConfig(response.body);
      expect(response.statusCode).to.equal(200);
      expect(runTimeConfig).to.not.include.key(
        'ember-cli-content-security-policy'
      );
    });

    it('does not push instance initializer into app if disabled', async function () {
      let response = await request({
        url: 'http://localhost:49742/assets/vendor.js',
        headers: {
          Accept: 'application/javascript',
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.not.include(
        'instance-initializers/content-security-policy'
      );
    });
  });

  describe('scenario: CSP header already defined', function () {
    before(async function () {
      // FastBoot App Server that sets a CSP header
      await fs.writeFile(
        path.join(testProject.path, 'server-with-csp.js'),
        `
          const FastBootAppServer = require('fastboot-app-server');
          const ExpressHTTPServer = require('fastboot-app-server/src/express-http-server');

          const httpServer = new ExpressHTTPServer({
            port: 49742,
          });
          const app = httpServer.app;

          app.use(function (req, res, next) {
            res.append('Content-Security-Policy', "default-src 'http://examples.com';");
            next();
          });

          let server = new FastBootAppServer({
            distPath: 'dist',
            httpServer: httpServer,
          });

          server.start();
        `
      );

      await testProject.runEmberCommand('build');
      await startServer('server-with-csp.js');
    });

    after(async function () {
      await stopServer();
      await removeConfig(testProject);
    });

    it('does not override existing CSP header if served via FastBoot', async function () {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          Accept: 'text/html',
        },
      });
      expect(response.headers).to.include.key('content-security-policy');

      // We would expect that the response CSP header equals the header, which
      // was set in before middleware:
      //   expect(response.headers['content-security-policy'])
      //     .to
      //     .equal("default-src 'http://examples.com';");
      // But FastBoot App Server has a bug, which causes a header added in
      // before middleware to be applied twice:
      // https://github.com/ember-fastboot/fastboot-app-server/issues/130
      // To not have our pipeline failing due to this bug we allow both for
      // now until the upstream bug is fixed
      expect(response.headers['content-security-policy']).to.be.oneOf([
        // correct version
        "default-src 'http://examples.com';",
        // output of FastBoot App Server due to bug
        "default-src 'http://examples.com';, default-src 'http://examples.com';",
      ]);

      expect(response.headers).to.not.include.key(
        'content-security-policy-report-only'
      );
    });
  });
});
