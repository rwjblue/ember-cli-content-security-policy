const expect = require('chai').expect;
const calculateConfig = require('../../index')._calculateConfig;

describe('unit: configuration', function() {
  let UIMock;

  beforeEach(() => {
    UIMock = {
      writeWarnLine() {},
    }
  });

  it('is enabled by default', function() {
    let config = calculateConfig('development', {}, {}, UIMock);

    expect(config.enabled).to.be.true;
  });

  it('delivers CSP by HTTP header by default', function() {
    let config = calculateConfig('development', {}, {}, UIMock);
    expect(config.delivery).to.deep.equal(['header']);
  });

  it('defaults to report only mode', function() {
    let config = calculateConfig('development', {}, {}, UIMock);

    expect(config.reportOnly).to.be.true;
  });

  describe('legacy support', function() {
    it('supports `contentSecurityPolicy` config option', function() {
      let policy = {
        'default-src': ['"self"'],
        'font-src': ["'self'", "http://fonts.gstatic.com"],
      };
      let config = calculateConfig(
        'development',
        {},
        { contentSecurityPolicy: policy },
        UIMock
      );
      expect(config.policy).to.deep.equal(policy);
    });

    it('supports `contentSecurityPolicyMeta` config option', function() {
      let config = calculateConfig('development', {}, { contentSecurityPolicyMeta: true }, UIMock);
      expect(config.delivery).to.include('meta');

      config = calculateConfig(
        'development',
        {},
        { contentSecurityPolicyMeta: false },
        UIMock
      );
      expect(config.delivery).to.not.include('meta');
    });

    it('supports `contentSecurityPolicyHeader` config', function() {
      let config = calculateConfig(
        'development',
        {},
        { contentSecurityPolicyHeader: 'Content-Security-Policy-Report-Only' },
        UIMock
      );
      expect(config.reportOnly).to.be.true;

      config = calculateConfig(
        'development',
        {},
        { contentSecurityPolicyHeader: 'Content-Security-Policy' },
        UIMock
      );
      expect(config.reportOnly).to.be.false;
    });
  });
});
