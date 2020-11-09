const expect = require('chai').expect;
const { appendSourceList } = require('../../lib/utils');

describe('unit: appendSourceList', function() {
  it('appends to existing directive', function() {
    let sourceList = {
      'default-src': ["'none'"],
      'script-src': ["'self'"],
    };

    appendSourceList(sourceList, 'script-src', 'examples.com');
    expect(sourceList).to.have.all.keys('default-src', 'script-src');
    expect(sourceList['script-src']).to.be.an('array');
    expect(sourceList['script-src']).to.contain("'self'");
    expect(sourceList['script-src']).to.contain('examples.com');
  });

  it('initalizes a not yet defined directive with default-src', function() {
    let sourceList = {
      'default-src': ["'self'"]
    };

    appendSourceList(sourceList, 'script-src', 'examples.com');
    expect(sourceList).to.have.all.keys('default-src', 'script-src');
    expect(sourceList['script-src']).to.be.an('array');
    expect(sourceList['script-src']).to.contain("'self'");
    expect(sourceList['script-src']).to.contain('examples.com');
    expect(sourceList['default-src']).to.deep.equal(["'self'"]);
  });

  it("removes existing 'none' keyword", function() {
    let sourceList = {
      'script-src': ["'none'"],
    };

    appendSourceList(sourceList, 'script-src', 'examples.com');
    expect(sourceList['script-src']).to.deep.equal(['examples.com']);
  });
});
