#!/usr/bin/env node
'use strict';
require('../core-upgrade.js');

/**
 * A client for testing round-tripping of articles.
 */
var request = require('request');
var cluster = require('cluster');
var exec = require('child_process').exec;
var Utils = require('../utils/Utils.js').Utils;
var Promise = require('../utils/promise.js');

var commit;
var ctime;
var lastCommit;
var lastCommitTime;
var lastCommitCheck;

var config = require(process.argv[2] || './config.js');

var pidPrefix = '[' + process.pid + ']: ';

var logger = function(msg) { console.log(pidPrefix + msg); };

var getTitle = function(cb) {
	var requestOptions = {
		uri: 'http://' + config.server.host + ':' +
			config.server.port + '/title?commit=' + commit + '&ctime=' + encodeURIComponent(ctime),
		method: 'GET',
	};

	var callback = function(error, response, body) {
		if (error || !response) {
			setTimeout(function() { cb('start'); }, 15000);
			return;
		}

		var resp;
		switch (response.statusCode) {
			case 200:
				resp = JSON.parse(body);
				cb('runTest', resp);
				break;
			case 404:
				logger('The server does not have any work for us right now, waiting half a minute....');
				setTimeout(function() { cb('start'); }, 30000);
				break;
			case 426:
				logger('Update required, exiting.');
				// Signal our voluntary suicide to the parent if running as a
				// cluster worker, so that it does not restart this client.
				// Without this, the code is never actually updated as a newly
				// forked client will still run the old code.
				if (cluster.worker) {
					cluster.worker.kill();
				} else {
					process.exit(0);
				}
				break;
			default:
				logger('There was some error (' + response.statusCode + '), but that is fine. Waiting 15 seconds to resume....');
				setTimeout(function() { cb('start'); }, 15000);
		}
	};

	Utils.retryingHTTPRequest(10, requestOptions, callback);
};

var runTest = function(cb, test, retryCount) {
	// Abort test if no result is returned in this timeframe.
	// Default: 5 minutes.
	// Add a random (max 500ms) shift in case multiple testreduce
	// clients fails and they don't all retry in lockstep fashion.
	var timeoutVal = Math.round(Math.random()*500) + (config.opts.testTimeout || 5*60*1000);
	config.runTest(config.opts, test).then(function(results) {
		cb('postResult', null, results, test, null);
	})
	.timeout(timeoutVal)
	.catch(function(err) {
		// Log it to console
		console.error(pidPrefix + 'Error in %s:%s: %s\n%s', test.prefix, test.title, err, err.stack || '');

		// Can be one of many errors ...
		// 1. Timeout because of a stuck test
		//    (ex: phantomjs in visualdiffs)
		// 2. Other transient retry-able error
		//    (ex: failed uprightdiff, failed postprocessing in visualdiffs)
		var maxRetries = config.opts.maxRetries || 1;
		if (retryCount === undefined) {
			retryCount = 0;
		}
		if (retryCount < maxRetries) {
			console.error(pidPrefix + 'Retry # ' + retryCount);
			runTest(cb, test, retryCount + 1);
			return;
		}

		console.error(pidPrefix + 'No more retries!');

		/*
		 * If you're looking at the line below and thinking "Why in the
		 * hell would they have done that, it causes unnecessary problems
		 * with the clients crashing", you're absolutely right. This is
		 * here because we use a supervisor instance to run our test
		 * clients, and we rely on it to restart dead'ns.
		 *
		 * In sum, easier to die than to worry about having to reset any
		 * broken application state.
		 */
		cb('postResult', err, null, test,  function() { process.exit(1); });
	});
};

var defaultGitCommitFetch = function(repoPath) {
	return new Promise(function(resolve, reject) {
		exec('git log --max-count=1 --pretty=format:"%H %ci"', { cwd: repoPath }, function(err, data) {
			if (err) {
				reject(err);
				return;
			}

			var cobj = data.match(/^([^ ]+) (.*)$/);
			if (!cobj) {
				reject("Error, couldn't find the current commit");
			} else {
				// convert the timestamp to UTC
				resolve([cobj[1], new Date(cobj[2]).toISOString()]);
			}
		});
	});
};

/**
 * Get the current git commit hash.
 * Returns a fulfillment promise.
 * Checks for updated code every 5 minutes.
 */
var getGitCommit = function() {
	var p;
	var now = Date.now();
	if (!lastCommitCheck || (now - lastCommitCheck) > (5 * 60 * 1000)) {
		lastCommitCheck = now;
		if (config.gitCommitFetch) {
			p = config.gitCommitFetch(config.opts);
			// If we got a fixed string, construct
			// an immediately resolved promise.
			if (typeof p === 'string') {
				p = Promise.resolve([p, new Date().toISOString()]);
			}
		} else {
			p = defaultGitCommitFetch(config.gitRepoPath);
		}
	} else {
		p = Promise.resolve([lastCommit, lastCommitTime]);
	}
	return p;
};

var postResult = function(err, result, test, finalCB, cb) {
	getGitCommit().then(function(res) {
		if (!res[0]) {
			throw new Error('Could not find the current commit.');
		}

		if (err) {
			if (config.postJSON) {
				result = {
					err: { name: err.name, msg: err.toString(), },
				};
			} else {
				result =
					'<error type="' + err.name + '">' +
					err.toString() +
					'</error>';
			}
		}

		var postOpts = {
			uri: 'http://' + config.server.host + ":" + config.server.port + '/result/' + encodeURIComponent(test.title) + '/' + test.prefix,
			method: 'POST',
			headers: {
				'Connection': 'close',
			},
		};

		var out = {
			results: result,
			commit: res[0],
			ctime: res[1],
			test: test,
		};

		if (config.postJSON) {
			postOpts.headers['Content-Type'] = 'application/json; charset=utf-8';
			postOpts.body = JSON.stringify(out);
		} else {
			postOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
			postOpts.form = out;
		}

		request(postOpts, function(err2) {
			if (err2) {
				logger('Error processing posted result: ' + err2);
				logger('Posted form: ' + JSON.stringify(out));
			}
			if (finalCB) {
				finalCB();
			} else {
				cb('start');
			}
		});
	}).catch(function(err3) {
		logger('Error: ' + err3 + '; stack: ' + err3.stack);
		process.exit(1);
	});
};

var callbackOmnibus = function(which) {
	var args = Array.prototype.slice.call(arguments);
	var test;
	switch (args.shift()) {
		case 'runTest':
			test = args[0];
			logger('Running a test on ' + test.prefix + ':' + test.title + ' ....');
			args.unshift(callbackOmnibus);
			runTest.apply(null, args);
			break;

		case 'postResult':
			test = args[2];
			logger('Posting a result for ' + test.prefix + ':' + test.title + ' ....');
			args.push(callbackOmnibus);
			postResult.apply(null, args);
			break;

		case 'start':
			getGitCommit().then(function(res) {
				if (res[0] !== commit) {
					logger('Exiting because the commit hash change. ' +
						'Expected: ' + commit +
						'; Got: ' + res[0]);
					process.exit(0);
				}

				getTitle(callbackOmnibus);
			}).catch(function(err) {
				logger('Could not find latest commit. ' + err);
				process.exit(1);
			});
			break;

		default:
			console.assert(false, 'Bad callback argument: ' + which);
	}
};

if (typeof module === 'object') {
	module.exports.getTitle = getTitle;
	module.exports.runTest = runTest;
	module.exports.postResult = postResult;
}

if (module && !module.parent) {
	var getGitCommitCb = function(commitHash, commitTime) {
		lastCommit = commit = commitHash;
		lastCommitTime = ctime = commitTime;
		callbackOmnibus('start');
	};

	// Enable heap dumps in /tmp on kill -USR2.
	// See https://github.com/bnoordhuis/node-heapdump/
	// For node 0.6/0.8: npm install heapdump@0.1.0
	// For 0.10: npm install heapdump
	process.on('SIGUSR2', function() {
		var heapdump = require('heapdump');
		console.error('SIGUSR2 received! Writing snapshot.');
		process.chdir('/tmp');
		heapdump.writeSnapshot();
	});

	getGitCommit().spread(getGitCommitCb).done();
}
