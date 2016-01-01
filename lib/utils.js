/* global module */
'use strict';

var unique = function(array) {
  return array.filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });
};

var buildPolicyString = function(policyObject) {
  return Object.keys(policyObject).reduce(function(memo, name) {
    var value = policyObject[name];
    if (value === null) {
      // Override the default value of `'self'`. Instead no entry will be included
      // in the CSP. This, in turn, will cause the CSP to fallback to `default-src`
      // for this directive. http://www.w3.org/TR/CSP2/#default-src-usage
      return memo;
    } else {
      var sourceList = Array.isArray(value) ? unique(value).join(' ') : value;
      return memo + name + ' ' + sourceList + '; ';
    }
  }, '');
};

module.exports = { buildPolicyString: buildPolicyString };
