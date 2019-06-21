const expect = require('chai').expect;
const calculateConfig = require('../../index')._calculateConfig;

function getAppMock(customOptions = {}) {
  let options = Object.assign({
    environment: 'development',
    runtimeConfig: {},
    buildConfig: {
      liveReload: true,
    },
  }, customOptions);

  return {
    env: options.environment,
    options: options.buildConfig,
    project: {
      config() {
        return options.runtimeConfig;
      },
      ui: {
        writeWarnLine() {},
      },
    },
  };
}

describe('unit: configuration', function() {
  it('is enabled by default', function() {
    let config = calculateConfig(getAppMock());

    expect(config.enabled).to.be.true;
  });

  it('delivers CSP by HTTP header by default', function() {
    let config = calculateConfig(getAppMock());
    expect(config.delivery).to.deep.equal(['header']);
  });

  it('defaults to report only mode', function() {
    let config = calculateConfig(getAppMock());

    expect(config.reportOnly).to.be.true;
  });

  describe('legacy support', function() {
    it('supports `contentSecurityPolicy` config option', function() {
      let policy = {
        'default-src': ['"self"'],
        'font-src': ["'self'", "http://fonts.gstatic.com"],
      };
      let config = calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicy: policy,
        },
      }));
      expect(config.policy).to.deep.equal(policy);
    });

    it('supports `contentSecurityPolicyMeta` config option', function() {
      let config = calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicyMeta: true,
        },
      }));
      expect(config.delivery).to.include('meta');

      config = calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicyMeta: false,
        },
      }));
      expect(config.delivery).to.not.include('meta');
    });

    it('supports `contentSecurityPolicyHeader` config', function() {
      let config = calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicyHeader: 'Content-Security-Policy-Report-Only',
        },
      }));
      expect(config.reportOnly).to.be.true;

      config = calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicyHeader: 'Content-Security-Policy',
        },
      }));
      expect(config.reportOnly).to.be.false;
    });
  });
});
