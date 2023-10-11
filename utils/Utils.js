'use strict';

const request = require('request');
const Promise = require('../utils/promise.js');

/**
 * @class
 * @singleton
 */
const Utils = {};

/**
 * Perform a HTTP request using the 'request' package, and retry on failures
 *
 * Only use on idempotent HTTP end points
 *
 * @param {number} retries The number of retries to attempt.
 * @param {Object} requestOptions Request options.
 * @param {Function} cb Request callback.
 * @param {Error} cb.error
 * @param {Object} cb.response
 * @param {Object} cb.body
 */
Utils.retryingHTTPRequest = function(retries, requestOptions, cb) {
	let delay = 100;  // start with 100ms
	const errHandler = function(error, response, body) {
		if (error) {
			if (retries--) {
				console.error('HTTP ' + requestOptions.method + ' to \n' +
						(requestOptions.uri || requestOptions.url) + ' failed: ' + error +
						'\nRetrying in ' + (delay / 1000) + ' seconds.');
				setTimeout(function() { request(requestOptions, errHandler); }, delay);
				// exponential back-off
				delay = delay * 2;
				return;
			}
		}
		cb(error, response, body);
	};
	request(requestOptions, errHandler);
};

// Helper function to ease migration to Promise-based control flow
// (aka, "after years of wandering, arrive in the Promise land").
// This function allows retrofitting an existing callback-based
// method to return an equivalent Promise, allowing enlightened
// new code to omit the callback parameter and treat it as if
// it had an API which simply returned a Promise for the result.
//
// Sample use:
//   // callback is node-style: callback(err, value)
//   function legacyApi(param1, param2, callback) {
//     callback = Utils.mkPromised(callback); // THIS LINE IS NEW
//     ... some implementation here...
//     return callback.promise; // THIS LINE IS NEW
//   }
//   // old-style caller, still works:
//   legacyApi(x, y, function(err, value) { ... });
//   // new-style caller, such hotness:
//   return legacyApi(x, y).then(function(value) { ... });
//
// The optional `names` parameter to `mkPromised` is the same
// as the optional second argument to `Promise.promisify` in
// https://github/cscott/prfun
// It allows the use of `mkPromised` for legacy functions which
// promise multiple results to their callbacks, eg:
//   callback(err, body, response);  // from npm "request" module
// For this callback signature, you have two options:
// 1. Pass `true` as the names parameter:
//      function legacyRequest(options, callback) {
//        callback = Utils.mkPromised(callback, true);
//        ... existing implementation...
//        return callback.promise;
//      }
//    This resolves the promise with the array `[body, response]`, so
//    a Promise-using caller looks like:
//      return legacyRequest(options).then(function(r) {
//        var body = r[0], response = r[1];
//        ...
//      }
//    If you are using `prfun` then `Promise#spread` is convenient:
//      return legacyRequest(options).spread(function(body, response) {
//        ...
//      });
// 2. Alternatively (and probably preferably), provide an array of strings
//    as the `names` parameter:
//      function legacyRequest(options, callback) {
//        callback = Utils.mkPromised(callback, ['body','response']);
//        ... existing implementation...
//        return callback.promise;
//      }
//    The resolved value will be an object with those fields:
//      return legacyRequest(options).then(function(r) {
//        var body = r.body, response = r.response;
//        ...
//      }
// Note that in both cases the legacy callback behavior is unchanged:
//   legacyRequest(options, function(err, body, response) { ... });
//
Utils.mkPromised = function(callback, names) {
	let res, rej;
	const p = new Promise(function(_res, _rej) { res = _res; rej = _rej; });
	const f = function(e, v) {
		if (e) {
			rej(e);
		} else if (names === true) {
			res(Array.prototype.slice.call(arguments, 1));
		} else if (names) {
			const value = {};
			for (const index in names) {
				value[names[index]] = arguments[(+index) + 1];
			}
			res(value);
		} else {
			res(v);
		}
		return callback && callback.apply(this, arguments);
	};
	f.promise = p;
	return f;
};

if (typeof module === "object") {
	module.exports.Utils = Utils;
}
