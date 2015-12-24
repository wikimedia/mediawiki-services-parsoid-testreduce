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
				console.log('The server doesn\'t have any work for us right now, waiting half a minute....');
				setTimeout(function() { cb('start'); }, 30000);
				break;
			case 426:
				console.log("Update required, exiting.");
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
				console.log('There was some error (' + response.statusCode + '), but that is fine. Waiting 15 seconds to resume....');
				setTimeout(function() { cb('start'); }, 15000);
		}
	};

	Utils.retryingHTTPRequest(10, requestOptions, callback);
};

var runTest = function(cb, test) {
	config.runTest(config.opts, test).then(function(results) {
		cb('postResult', null, results, test, null);
	}).catch(function(err) {
		// Log it to console
		console.error('Error in %s:%s: %s\n%s', test.prefix, test.title, err, err.stack || '');

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
				lastCommit = cobj[1];
				// convert the timestamp to UTC
				lastCommitTime = new Date(cobj[2]).toISOString();
				// console.log( 'New commit: ', cobj[1], lastCommitTime );
				resolve([cobj[1], lastCommitTime]);
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
			throw new Error('');
		}

		if (err) {
			result =
				'<error type="' + err.name + '">' +
				err.toString() +
				'</error>';
		}

		var uri = 'http://' + config.server.host + ":" + config.server.port + '/result/' + encodeURIComponent(test.title) + '/' + test.prefix;
		var form = {
			results: result,
			commit: res[0],
			ctime: res[1],
			test: test,
		};
		var postOpts = {
			uri: uri,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Connection': 'close',
			},
			form: form,
		};

		request(postOpts, function(err2) {
			if (err2) {
				console.log("Error processing posted result: " + err2);
				console.log("Posted form: " + JSON.stringify(form));
			}
			if (finalCB) {
				finalCB();
			} else {
				cb('start');
			}
		});
	}).catch(function(err3) {
		console.log("Exiting, couldn't find the current commit.");
		console.log("Error: " + err3 + "; stack: " + err3.stack);
		process.exit(1);
	});
};

var callbackOmnibus = function(which) {
	var args = Array.prototype.slice.call(arguments);
	var test;
	switch (args.shift()) {
		case 'runTest':
			test = args[0];
			console.log('Running a test on', test.prefix + ':' + test.title, '....');
			args.unshift(callbackOmnibus);
			runTest.apply(null, args);
			break;

		case 'postResult':
			test = args[2];
			console.log('Posting a result for', test.prefix + ':' + test.title, '....');
			args.push(callbackOmnibus);
			postResult.apply(null, args);
			break;

		case 'start':
			getGitCommit().then(function(res) {
				if (res[0] !== commit) {
					console.log('Exiting because the commit hash changed');
					process.exit(0);
				}

				getTitle(callbackOmnibus);
			}).catch(function(err) {
				console.log("Couldn't find latest commit.", err);
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
		commit = commitHash;
		ctime = commitTime;
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
