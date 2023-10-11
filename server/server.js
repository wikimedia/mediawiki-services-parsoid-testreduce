#!/usr/bin/env node
"use strict";

const bodyParser = require('body-parser');
const busboy = require('connect-busboy');
const express = require('express');
const yargs = require('yargs');
const ehbs = require('express-handlebars');
const path = require('path');
const Diff = require('./diff.js').Diff;
const RH = require('./render.helpers.js').RenderHelpers;
const Promise = require('../utils/promise.js');
const mysql = require('mysql2');

// Default options
const defaults = {
	'host':           'localhost',
	'port':           3306,
	'database':       'testreduce',
	'user':           'testreduce',
	'password':       'testreduce',
	'debug':          false,
	'fetches':        6,
	'tries':          6,
	'cutofftime':     600,
	'batch':          50,
	generateTitleUrl: function(server, prefix, title) {
		return server.replace(/\/$/, '') + "/_rt/" + prefix + "/" + title;
	},
};

// Command line options
const opts = yargs.usage('Usage: $0 [connection parameters]')
	.options('help', {
		'boolean': true,
		'default': false,
		describe: "Show usage information.",
	})
	.options('config', {
		describe: 'Configuration file for the server',
		'default': './server.settings.js',
	})
	.options('s', {
		alias: 'socketPath',
		describe: 'Socket path for the database server (if set, host/port will be ignored).',
	})
	.options('h', {
		alias: 'host',
		describe: 'Hostname of the database server.',
	})
	.options('P', {
		alias: 'port',
		describe: 'Port number to use for connection.',
	})
	.options('D', {
		alias: 'database',
		describe: 'Database to use.',
	})
	.options('u', {
		alias: 'user',
		describe: 'User for MySQL login.',
	})
	.options('p', {
		alias: 'password',
		describe: 'Password.',
	})
	.options('d', {
		alias: 'debug',
		'boolean': true,
		describe: "Output MySQL debug data.",
	})
	.options('f', {
		alias: 'fetches',
		describe: "Number of times to try fetching a page.",
	})
	.options('t', {
		alias: 'tries',
		describe: "Number of times an article will be sent for testing " +
			"before it's considered an error.",
	})
	.options('c', {
		alias: 'cutofftime',
		describe: "Time in seconds to wait for a test result.",
	})
	.options('b', {
		alias: 'batch',
		describe: "Number of titles to fetch from database in one batch.",
	});
const argv = opts.argv;

if (argv.help) {
	opts.showHelp();
	process.exit(0);
}

// Settings file
let settings;
try {
	settings = require(argv.config);
} catch (e) {
	console.error("Aborting! Exception reading " + argv.config + ": " + e);
	return;
}

// SSS FIXME: Awkward, but does the job for now.
// Helpers need settings
RH.settings = settings;

const perfConfig = settings.perfConfig;
const parsoidRTConfig = settings.parsoidRTConfig;

function getOption(opt) {
	let value;

	// Check possible options in this order: command line, settings file, defaults.
	if (argv.hasOwnProperty(opt)) {
		value = argv[ opt ];
	} else if (settings.hasOwnProperty(opt)) {
		value = settings[ opt ];
	} else if (defaults.hasOwnProperty(opt)) {
		value = defaults[ opt ];
	} else {
		return undefined;
	}

	// Check the boolean options, 'false' and 'no' should be treated as false.
	// Copied from mediawiki.Util.js.
	if (opt === 'debug') {
		if ((typeof value) === 'string' && /^(no|false)$/i.test(value)) {
			return false;
		}
	}
	return value;
}

// The maximum number of tries per article
const maxTries = getOption('tries');
// The maximum number of fetch retries per article
const maxFetchRetries = getOption('fetches');
// The time to wait before considering a test has failed
const cutOffTime = getOption('cutofftime');
// The number of pages to fetch at once
const batchSize = getOption('batch');
const debug = getOption('debug');

const pool = mysql.createPool({
	socketPath:         getOption('socketPath'), // if set, host:port will be ignored
	host:               getOption('host'),
	port:               getOption('port'),
	database:           getOption('database'),
	user:               getOption('user'),
	password:           getOption('password'),
	multipleStatements: true,
	charset:            'utf8mb4',
	debug:              debug,
});

process.on('exit', function() {
	pool.end();
});

// ----------------- The queries --------------
const dbGetTitle =
	'SELECT * FROM (' +
	'  SELECT id, title, prefix, claim_hash, claim_num_tries ' +
	'  FROM pages ' +
	'  WHERE num_fetch_errors < ? AND ' +
	'  ( claim_hash != ? OR ( claim_num_tries < ? AND claim_timestamp < ? ) )' +
	'  ORDER BY claim_num_tries DESC, claim_timestamp ASC LIMIT 500 ' +
	// Stop other transactions from reading until we finish this one.
	'  FOR UPDATE' +
	') AS titles ORDER BY RAND() LIMIT ?';

const dbIncrementFetchErrorCount =
	'UPDATE pages SET ' +
		'claim_hash = ?, ' +
		'num_fetch_errors = num_fetch_errors + 1, ' +
		'claim_num_tries = 0 ' +
		'WHERE title = ? AND prefix = ?';

const dbInsertCommit =
	'INSERT IGNORE INTO commits ( hash, timestamp ) ' +
	'VALUES ( ?, ? )';

const dbFindPage =
	'SELECT id ' +
	'FROM pages ' +
	'WHERE title = ? AND prefix = ?';

const dbUpdatePageClaims =
	'UPDATE pages SET claim_hash = ?, claim_timestamp = ?, claim_num_tries = claim_num_tries + 1 ' +
	'WHERE id IN ( ? )';

const dbInsertResult =
	'INSERT INTO results ( page_id, commit_hash, result ) ' +
	'VALUES ( ?, ?, ? ) ' +
	'ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID( id ), ' +
		'result = VALUES( result )';

const dbInsertStats =
	'INSERT INTO stats ' +
	'( skips, fails, errors, selser_errors, score, page_id, commit_hash ) ' +
	'VALUES ( ?, ?, ?, ?, ?, ?, ? ) ' +
	'ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID( id ), ' +
		'skips = VALUES( skips ), fails = VALUES( fails ), ' +
		'errors = VALUES( errors ), selser_errors = VALUES(selser_errors), ' +
		'score = VALUES( score )';

const dbUpdatePageLatestResults =
	'UPDATE pages ' +
	'SET latest_stat = ?, latest_score = ?, latest_result = ?, ' +
	'claim_hash = ?, claim_timestamp = NULL, claim_num_tries = 0 ' +
    'WHERE id = ?';

const dbUpdateCrashersClearTries =
	'UPDATE pages ' +
	'SET claim_num_tries = 0 ' +
	'WHERE claim_hash != ? AND claim_num_tries >= ?';

const dbLatestHash = 'SELECT hash FROM commits ORDER BY timestamp DESC LIMIT 1';
const dbPreviousHash = 'SELECT hash FROM commits ORDER BY timestamp DESC LIMIT 1 OFFSET 1';

const dbStatsQuery =
	'SELECT ? AS maxhash, ? AS secondhash, ' +
	'(SELECT count(*) FROM stats WHERE stats.commit_hash = ?) AS maxresults, ' +
	'count(*) AS total, ' +
	'count(CASE WHEN stats.errors=0 THEN 1 ELSE NULL END) AS no_errors, ' +
	'count(CASE WHEN stats.errors=0 AND stats.fails=0 ' +
		'then 1 else null end) AS no_fails, ' +
	'count(CASE WHEN stats.errors=0 AND stats.fails=0 AND stats.skips=0 ' +
		'then 1 else null end) AS no_skips, ' +
	// get regression count between last two commits
	'(SELECT count(*) ' +
	'FROM pages p ' +
	'JOIN stats AS s1 ON s1.page_id = p.id ' +
	'JOIN stats AS s2 ON s2.page_id = p.id ' +
	'WHERE s1.commit_hash = ? ' +
	'AND s2.commit_hash = ? ' +
	'AND s1.score > s2.score ) as numregressions, ' +
	// get fix count between last two commits
	'(SELECT count(*) ' +
		'FROM pages ' +
		'JOIN stats AS s1 ON s1.page_id = pages.id ' +
		'JOIN stats AS s2 ON s2.page_id = pages.id ' +
		'WHERE s1.commit_hash = ? ' +
		'AND s2.commit_hash = ? ' +
		'AND s1.score < s2.score ) AS numfixes, '  +
	// Get latest commit crashers
	'(SELECT count(*) ' +
		'FROM pages ' +
		'WHERE claim_hash = ? ' +
			'AND claim_num_tries >= ? ' +
			'AND claim_timestamp < ?) AS crashers, ' +
	// Get num of rt selser errors
	'(SELECT count(*) ' +
		'FROM pages ' +
		'JOIN stats ON pages.id = stats.page_id ' +
		'WHERE stats.commit_hash = ? ' +
			'AND stats.selser_errors > 0) AS rtselsererrors ' +

	'FROM pages JOIN stats on pages.latest_stat = stats.id';

const dbPerWikiStatsQuery =
	'SELECT ' +
	'(select hash from commits order by timestamp desc limit 1) as maxhash, ' +
	'(select hash from commits order by timestamp desc limit 1 offset 1) as secondhash, ' +
	'(select count(*) from stats join pages on stats.page_id = pages.id ' +
		'where stats.commit_hash = ' +
		'(select hash from commits order by timestamp desc limit 1) ' +
		'and pages.prefix = ?) as maxresults, ' +
	'count(*) AS total, ' +
	'count(CASE WHEN stats.errors=0 THEN 1 ELSE NULL END) AS no_errors, ' +
	'count(CASE WHEN stats.errors=0 AND stats.fails=0 ' +
		'then 1 else null end) AS no_fails, ' +
	'count(CASE WHEN stats.errors=0 AND stats.fails=0 AND stats.skips=0 ' +
		'then 1 else null end) AS no_skips, ' +
	// get regression count between last two commits
	'(SELECT count(*) ' +
	'FROM pages p ' +
	'JOIN stats AS s1 ON s1.page_id = p.id ' +
	'JOIN stats AS s2 ON s2.page_id = p.id ' +
	'WHERE s1.commit_hash = (SELECT hash ' +
		'FROM commits ORDER BY timestamp DESC LIMIT 1 ) ' +
		'AND s2.commit_hash = (SELECT hash ' +
		'FROM commits ORDER BY timestamp DESC LIMIT 1 OFFSET 1) ' +
		'AND p.prefix = ? ' +
		'AND s1.score > s2.score ) as numregressions, ' +
	// get fix count between last two commits
	'(SELECT count(*) ' +
		'FROM pages ' +
		'JOIN stats AS s1 ON s1.page_id = pages.id ' +
		'JOIN stats AS s2 ON s2.page_id = pages.id ' +
		'WHERE s1.commit_hash = (SELECT hash FROM commits ORDER BY timestamp DESC LIMIT 1 ) ' +
		'AND s2.commit_hash = (SELECT hash FROM commits ORDER BY timestamp DESC LIMIT 1 OFFSET 1 ) ' +
		'AND pages.prefix = ? ' +
		'AND s1.score < s2.score ) as numfixes, ' +
	// Get latest commit crashers
	'(SELECT count(*) ' +
		'FROM pages WHERE prefix = ? ' +
			'AND claim_hash = (SELECT hash FROM commits ORDER BY timestamp DESC LIMIT 1) ' +
			'AND claim_num_tries >= ? ' +
			'AND claim_timestamp < ?) AS crashers, ' +
	// Get num of rt selser errors
	'(SELECT count(*) ' +
		'FROM pages ' +
		'JOIN stats ON pages.id = stats.page_id ' +
		'WHERE pages.prefix = ? ' +
			'AND stats.commit_hash = (SELECT hash FROM commits ORDER BY timestamp DESC LIMIT 1 ) ' +
			'AND stats.selser_errors > 0) AS rtselsererrors ' +

	'FROM pages JOIN stats on pages.latest_stat = stats.id WHERE pages.prefix = ?';

const dbFailsQuery =
	'SELECT pages.title, pages.prefix, commits.hash, stats.errors, stats.fails, stats.skips ' +
	'FROM stats ' +
	'JOIN (' +
	'	SELECT MAX(id) AS most_recent FROM stats GROUP BY page_id' +
	') AS s1 ON s1.most_recent = stats.id ' +
	'JOIN pages ON stats.page_id = pages.id ' +
	'JOIN commits ON stats.commit_hash = commits.hash ' +
	'ORDER BY stats.score DESC ' +
	'LIMIT 40 OFFSET ?';

const dbGetOneResult =
	'SELECT result FROM results ' +
	'JOIN commits ON results.commit_hash = commits.hash ' +
	'JOIN pages ON pages.id = results.page_id ' +
	'WHERE pages.title = ? AND pages.prefix = ? ' +
	'ORDER BY commits.timestamp DESC LIMIT 1';

const dbGetResultWithCommit =
    'SELECT result FROM results ' +
    'JOIN pages ON pages.id = results.page_id ' +
    'WHERE results.commit_hash = ? AND pages.title = ? AND pages.prefix = ?';

const dbFailedFetches =
	'SELECT title, prefix FROM pages WHERE num_fetch_errors >= ?';

const dbCrashers =
	'SELECT pages.title, pages.prefix, pages.claim_hash, commits.timestamp ' +
		'FROM pages JOIN commits ON (pages.claim_hash = commits.hash) ' +
		'WHERE claim_num_tries >= ? ' +
		'AND claim_timestamp < ? ' +
		'ORDER BY commits.timestamp DESC';

const dbFailsDistribution =
	'SELECT fails, count(*) AS num_pages ' +
	'FROM stats ' +
	'JOIN pages ON pages.latest_stat = stats.id ' +
	'GROUP by fails';

const dbSkipsDistribution =
	'SELECT skips, count(*) AS num_pages ' +
	'FROM stats ' +
	'JOIN pages ON pages.latest_stat = stats.id ' +
	'GROUP by skips';

// Limit to 100 recent commits
const dbCommits =
	'SELECT hash, timestamp ' +
	/*
	// get the number of fixes column
		'(SELECT count(*) ' +
		'FROM pages ' +
			'JOIN stats AS s1 ON s1.page_id = pages.id ' +
			'JOIN stats AS s2 ON s2.page_id = pages.id ' +
		'WHERE s1.commit_hash = (SELECT hash FROM commits c2 where c2.timestamp < c1.timestamp ORDER BY timestamp DESC LIMIT 1 ) ' +
			'AND s2.commit_hash = c1.hash AND s1.score < s2.score) as numfixes, ' +
	// get the number of regressions column
		'(SELECT count(*) ' +
		'FROM pages ' +
			'JOIN stats AS s1 ON s1.page_id = pages.id ' +
			'JOIN stats AS s2 ON s2.page_id = pages.id ' +
		'WHERE s1.commit_hash = (SELECT hash FROM commits c2 where c2.timestamp < c1.timestamp ORDER BY timestamp DESC LIMIT 1 ) ' +
			'AND s2.commit_hash = c1.hash AND s1.score > s2.score) as numregressions, ' +

	// get the number of tests for this commit column
		'(select count(*) from stats where stats.commit_hash = c1.hash) as numtests ' +
	*/
	'FROM commits c1 ' +
	'ORDER BY timestamp DESC LIMIT 100';

const dbCommitHashes =
	'SELECT hash FROM commits ORDER BY timestamp DESC';

const dbFixesBetweenRevs =
	'SELECT pages.title, pages.prefix, ' +
	's1.commit_hash AS new_commit, s1.errors AS errors, s1.fails AS fails, s1.skips AS skips, ' +
	's2.commit_hash AS old_commit, s2.errors AS old_errors, s2.fails AS old_fails, s2.skips AS old_skips ' +
	'FROM pages ' +
	'JOIN stats AS s1 ON s1.page_id = pages.id ' +
	'JOIN stats AS s2 ON s2.page_id = pages.id ' +
	'WHERE s1.commit_hash = ? AND s2.commit_hash = ? AND s1.score < s2.score ' +
	'ORDER BY s1.score - s2.score ASC ' +
	'LIMIT 40 OFFSET ?';

const dbNumFixesBetweenRevs =
	'SELECT count(*) as numFixes ' +
	'FROM pages ' +
	'JOIN stats AS s1 ON s1.page_id = pages.id ' +
	'JOIN stats AS s2 ON s2.page_id = pages.id ' +
	'WHERE s1.commit_hash = ? AND s2.commit_hash = ? AND s1.score < s2.score ';

const dbRegressionsBetweenRevs =
	'SELECT pages.title, pages.prefix, ' +
	's1.commit_hash AS new_commit, s1.errors AS errors, s1.fails AS fails, s1.skips AS skips, ' +
	's2.commit_hash AS old_commit, s2.errors AS old_errors, s2.fails AS old_fails, s2.skips AS old_skips ' +
	'FROM pages ' +
	'JOIN stats AS s1 ON s1.page_id = pages.id ' +
	'JOIN stats AS s2 ON s2.page_id = pages.id ' +
	'WHERE s1.commit_hash = ? AND s2.commit_hash = ? AND s1.score > s2.score ' +
	'ORDER BY s1.score - s2.score DESC ' +
	'LIMIT 40 OFFSET ?';

const dbNumRegressionsBetweenRevs =
	'SELECT count(*) as numRegressions ' +
	'FROM pages ' +
	'JOIN stats AS s1 ON s1.page_id = pages.id ' +
	'JOIN stats AS s2 ON s2.page_id = pages.id ' +
	'WHERE s1.commit_hash = ? AND s2.commit_hash = ? AND s1.score > s2.score ';

const dbResultsQuery =
	'SELECT result FROM results';

const dbResultsPerWikiQuery =
	'SELECT result FROM results ' +
	'JOIN pages ON pages.id = results.page_id ' +
	'WHERE pages.prefix = ?';

const dbGetTwoResults =
	'SELECT result FROM results ' +
	'JOIN commits ON results.commit_hash = commits.hash ' +
	'JOIN pages ON pages.id = results.page_id ' +
	'WHERE pages.title = ? AND pages.prefix = ? ' +
	'AND (commits.hash = ? OR commits.hash = ?) ' +
	'ORDER BY commits.timestamp';

function fetchCB(msg, failCb, successCb, err, result) {
	if (err) {
		if (failCb) {
			failCb(msg ? msg + err.toString() : err, result);
		}
	} else if (successCb) {
		successCb(result);
	}
}

function fetchPages(commitHash, cutOffTimestamp, cb, res) {
	pool.getConnection(function (err, connection) {
		if (err) { return handleErr(connection, err, res); }
		connection.beginTransaction(function(err) {
			if (err) { return handleErr(connection, err, res); }

			connection.query(dbGetTitle, [maxFetchRetries, commitHash, maxTries, cutOffTimestamp, batchSize], fetchCB.bind(null, 'Error getting next titles', cb, function(rows) {
				if (!rows || rows.length === 0) {
					cb(null, rows);
					connection.commit();
					connection.release();
				} else {
					// Process the rows: Weed out the crashers.
					const pages = [];
					const pageIds = [];
					for (let i = 0; i < rows.length; i++) {
						const row = rows[i];
						pageIds.push(row.id);
						pages.push({ id: row.id, prefix: row.prefix, title: row.title });
					}
					connection.query(dbUpdatePageClaims, [commitHash, new Date(), pageIds], fetchCB.bind(null, 'Error updating claims', cb, function() {
						cb(null, pages);
						connection.commit();
						connection.release();
					}));
				}
			}));
		});
	});
}

let fetchedPages = [];
let lastFetchedCommit = null;
let lastFetchedDate = new Date(0);
let knownCommits;

function handleErr(connection, err, res) {
	if (connection) { connection.release(); }
	console.log(err);
	res.status(500).send(err.toString());
}

function getTitle(req, res) {
	const commitHash = req.query.commit;
	const commitDate = new Date(req.query.ctime);
	const knownCommit = knownCommits && knownCommits[ commitHash ];

	req.connection.setTimeout(300 * 1000);
	res.setHeader('Content-Type', 'text/plain; charset=UTF-8');

	// Keep track of known commits so we can discard clients still on older
	// versions. If we don't know about the commit, then record it
	// Use a transaction to make sure we don't start fetching pages until
	// we've done this
	if (!knownCommit) {
		pool.getConnection(function (err, connection) {
			if (err) { return handleErr(connection, err, res); }

			connection.beginTransaction(function(err) {
				if (err) { return handleErr(connection, err, res); }

				if (!knownCommits) {
					knownCommits = {};
					connection.query(dbCommitHashes, null, function(err, resCommitHashes) {
						if (err) {
							console.log('Error fetching known commits', err);
						} else {
							resCommitHashes.forEach(function(v) {
								knownCommits[v.hash] = commitDate;
							});
						}
					});
				}

				// New commit, record it
				knownCommits[ commitHash ] = commitDate;
				connection.query(dbInsertCommit, [ commitHash, new Date() ], function(err, commitInsertResult) {
					if (err) {
						console.error("Error inserting commit " + commitHash);
					} else if (commitInsertResult.affectedRows > 0) {
						// If this is a new commit, we need to clear the number of times a
						// crasher page has been sent out so that each title gets retested
						connection.query(dbUpdateCrashersClearTries, [ commitHash, maxTries ]);
					}
				});

				connection.commit();
				connection.release();
			});
		});
	}
	if (knownCommit && commitHash !== lastFetchedCommit) {
		// It's an old commit, tell the client so it can restart.
		// HTTP status code 426 Update Required
		res.status(426).send("Old commit");
		return;
	}

	const fetchCB2 = function(err, pages) {
		if (err) {
			res.status(500).send("Error: " + err.toString());
			return;
		}

		if (pages) {
			// Get the pages that aren't already fetched, to guard against the
			// case of clients not finishing the whole batch in the cutoff time
			const newPages = pages.filter(function(p) {
				return fetchedPages.every(function(f) {
					return f.id !== p.id;
				});
			});
			// Append the new pages to the already fetched ones, in case there's
			// a parallel request.
			fetchedPages = fetchedPages.concat(newPages);
		}
		if (fetchedPages.length === 0) {
			// Send 404 to indicate no pages available now, clients depend on
			// this.
			res.status(404).send('No available titles that fit the constraints.');
		} else {
			const page = fetchedPages.pop();
			console.log(' ->', page.prefix + ':' + page.title);
			res.status(200).send(page);
		}
	};

	// Look if there's a title available in the already fetched ones.
	// Ensure that we load a batch when the commit has changed.
	if (fetchedPages.length === 0 ||
			commitHash !== lastFetchedCommit ||
			(lastFetchedDate.getTime() + (cutOffTime * 1000)) < Date.now()) {
		// Select pages that were not claimed in the 10 minutes.
		// If we didn't get a result from a client 10 minutes after
		// it got a rt claim on a page, something is wrong with the client
		// or with parsing the page.
		//
		// Hopefully, no page takes longer than 10 minutes to parse. :)

		lastFetchedCommit = commitHash;
		lastFetchedDate = new Date();
		fetchPages(commitHash, new Date(Date.now() - (cutOffTime * 1000)), fetchCB2, res);
	} else {
		fetchCB2();
	}
}

function statsScore(skipCount, failCount, errorCount) {
	// treat <errors,fails,skips> as digits in a base 1000 system
	// and use the number as a score which can help sort in topfails.
	return errorCount * 1000000 + failCount * 1000 + skipCount;
}

function receiveResults(req, res) {
	req.connection.setTimeout(300 * 1000);

	const title = req.params[0];
	const prefix = req.params[1];
	const commitHash = req.body.commit;
	const result = req.body.results;
	const contentType = req.headers["content-type"];

	let skipCount, failCount, errorCount, dneError, resultString;

	if (contentType.match(/application\/json/i)) {
		// console.warn("application/json");
		errorCount = result.err ? 1 : 0;
		failCount = parseInt(result.fails || "0");
		skipCount = parseInt(result.skips || "0");
		resultString = JSON.stringify(result);
	} else {
		// console.warn("old xml junit style");
		errorCount = result.match(/<error/g);
		errorCount = errorCount ? errorCount.length : 0;
		skipCount = result.match(/<skipped/g);
		skipCount = skipCount ? skipCount.length : 0;
		failCount = result.match(/<failure/g);
		failCount = failCount ? failCount.length : 0;
		dneError = result.match(/Error: Got status code: 404/g);
		resultString = result;
	}

	// Find the number of selser errors
	const selserErrorCount = parsoidRTConfig ? parsoidRTConfig.parseSelserStats(result) : 0;

	// Get perf stats
	const perfstats = perfConfig ? perfConfig.parsePerfStats(result) : null;

	res.setHeader('Content-Type', 'text/plain; charset=UTF-8');

	pool.getConnection(function (err, connection) {
		if (err) { return handleErr(connection, err, res); }

		connection.beginTransaction(function(err) {
			if (err) { return handleErr(connection, err, res); }

			const transUpdateCB = function(type, successCb, err, result2) {
				if (err) {
					connection.rollback();
					const msg = "Error inserting/updating " + type + " for page: " +  prefix + ':' + title + " and hash: " + commitHash;
					console.error(msg);
					console.error(err);
					if (res) {
						res.status(500).send(msg);
					}
				} else if (successCb) {
					successCb(result2);
				}
			};

			// console.warn("got: " + JSON.stringify([title, commitHash, result, skipCount, failCount, errorCount]));
			if (errorCount > 0 && dneError) {
				// Page fetch error, increment the fetch error count so, when it goes
				// over maxFetchRetries, it won't be considered for tests again.
				console.log('XX', prefix + ':' + title);
				connection.query(dbIncrementFetchErrorCount, [commitHash, title, prefix], function(err, results) {
					transUpdateCB("page fetch error count", null, err, results);
					connection.commit(function(err) {
						if (err) {
							console.error("Error incrementing fetch count: " + err.toString());
						}
						res.status(200).send('');
					});
					connection.release();
				});

			} else {
				connection.query(dbFindPage, [ title, prefix ], function(err, pages) {
					if (!err && pages.length === 1) {
						// Found the correct page, fill the details up
						const page = pages[0];
						const score = statsScore(skipCount, failCount, errorCount);
						let latestResultId = 0;
						let latestStatId = 0;
						// Insert the result
						connection.query(dbInsertResult, [ page.id, commitHash, resultString ],
							transUpdateCB.bind(null, "result", function(insertedResult) {
								latestResultId = insertedResult.insertId;
								// Insert the stats
								connection.query(dbInsertStats, [ skipCount, failCount, errorCount, selserErrorCount, score, page.id, commitHash ],
									transUpdateCB.bind(null, "stats", function(insertedStat) {
										latestStatId = insertedStat.insertId;

										// And now update the page with the latest info
										connection.query(dbUpdatePageLatestResults, [ latestStatId, score, latestResultId, commitHash, page.id ], function(err, results) {
											transUpdateCB.bind("latest result", null, err, results);
											connection.commit(function() {
												console.log('<- ', prefix + ':' + title, ':', skipCount, failCount,
													errorCount, commitHash.slice(0, 7));

												if (perfConfig) {
													// Insert the performance stats, ignoring errors for now
													perfConfig.insertPerfStats(pool, page.id, commitHash, perfstats, function() {});
												}

												// Maybe the perfstats aren't committed yet, but it shouldn't be a problem
												res.status(200).send('');
											});
											connection.release();
										});
									}));
							}));
					} else {
						connection.rollback(function() {
							if (err) {
								console.log('XX', prefix + ':' + title + "; ERR: " + err);
								res.status(500).send(err.toString());
							} else {
								console.log('XX', prefix + ':' + title + "; found non-unique pages. count: " + pages.length);
								res.status(200).send("Did not find claim for title: " + prefix + ':' + title);
							}
						});
						connection.release();
					}
				});
			}
		});
	});
}

const pageListData = [
	{ url: 'topfails', title: 'Results by title' },
	{ url: 'failedFetches', title: 'Non-existing test pages' },
	{ url: 'semanticDiffsDistr', title: 'Histogram of semantic diffs' },
	{ url: 'syntacticDiffsDistr', title: 'Histogram of syntactic diffs' },
	{ url: 'commits', title: 'List of all tested commits' },
];

if (perfConfig) {
	perfConfig.updateIndexPageUrls(pageListData);
}

if (parsoidRTConfig) {
	parsoidRTConfig.updateIndexPageUrls(pageListData);
}

function statsWebInterface(req, res) {
	const cutoffDate = new Date(Date.now() - (cutOffTime * 1000));
	const prefix = req.params[1] || null;
	let query, queryParams;

	pool.query(dbLatestHash, [], function(err, row) {
		if (err) { return handleErr(null, err, res); }

		const latestHash = row[0].hash;
		pool.query(dbPreviousHash, [], function(err, row) {
			if (err) { return handleErr(null, err, res); }
			const previousHash = row.length > 0 ? row[0].hash : 'null';

			// Switch the query object based on the prefix
			if (prefix !== null) {
				query = dbPerWikiStatsQuery;
				queryParams = [
					prefix, prefix, prefix, prefix,
					prefix, prefix, prefix, prefix,
					maxTries, cutoffDate, prefix, prefix,
				];
			} else {
				query = dbStatsQuery;
				queryParams = [
					latestHash, previousHash,
					latestHash,
					latestHash, previousHash,
					latestHash, previousHash,
					latestHash, maxTries, cutoffDate,
					latestHash
				];
			}

			// Fetch stats for commit
			pool.query(query, queryParams, function(err, row) {
				if (err) { return handleErr(null, err, res); }

				res.status(200);

				const tests = row[0].total;
				const errorLess = row[0].no_errors;
				const skipLess = row[0].no_skips;
				const numRegressions = row[0].numregressions;
				const numFixes = row[0].numfixes;
				const noErrors = Math.round(100 * 100 * errorLess / (tests || 1)) / 100;
				const perfects = Math.round(100 * 100 * skipLess / (tests || 1)) / 100;
				const syntacticDiffs = Math.round(100 * 100 *
					(row[0].no_fails / (tests || 1))) / 100;
				const width = 800;
				const data = {
					prefix: prefix,
					results: {
						tests: tests,
						noErrors: noErrors,
						syntacticDiffs: syntacticDiffs,
						perfects: perfects,
					},
					graphWidths: {
						perfect: width * perfects / 100 || 0,
						syntacticDiff: width * (syntacticDiffs - perfects) / 100 || 0,
						semanticDiff: width * (100 - syntacticDiffs) / 100 || 0,
					},
					latestRevision: [
						{
							description: 'Git SHA1',
							value: row[0].maxhash,
						},
						{
							description: 'Test Results',
							value: row[0].maxresults,
						},
						{
							description: 'Crashers',
							value: row[0].crashers,
							url: 'crashers',
						},
						{
							description: 'Fixes',
							value: numFixes,
							url: 'topfixes/between/' + row[0].secondhash + '/' + row[0].maxhash,
						},
						{
							description: 'Regressions',
							value: numRegressions,
							url: 'regressions/between/' + row[0].secondhash + '/' + row[0].maxhash,
						},
					],
					pages: pageListData,
				};

				if (perfConfig) {
					perfConfig.updateIndexData(data, row);
				}

				if (parsoidRTConfig) {
					parsoidRTConfig.updateIndexData(data, row);
					data.parsoidRT = true;
				}

				res.render('index.html', data);
			});
		});
	});
}

function makeFailsRow (urlPrefix, row) {
	return [
		RH.pageTitleData(urlPrefix, row),
		RH.commitLinkData(urlPrefix, row.hash, row.title, row.prefix),
		row.errors === null ? 0 : row.errors,
		row.fails,
		row.skips,
	];
}

function failsWebInterface(req, res) {
	const page = (req.params[0] || 0) - 0;
	const offset = page * 40;
	const relativeUrlPrefix = (req.params[0] ? '../' : '');
	const data = {
		page: page,
		relativeUrlPrefix: relativeUrlPrefix,
		urlPrefix: relativeUrlPrefix + 'topfails',
		urlSuffix: '',
		heading: 'Results by title',
		header: ['Title', 'Commit', 'Errors', 'Semantic diffs', 'Syntactic diffs'],
	};
	pool.query(dbFailsQuery, [ offset ],
		RH.displayPageList.bind(null, res, data, makeFailsRow));
}

function resultsWebInterface(req, res) {
	const prefix = req.params[1] || null;
	let query, queryParams;

	if (prefix !== null) {
		query = dbResultsPerWikiQuery;
		queryParams = [ prefix ];
	} else {
		query = dbResultsQuery;
		queryParams = [];
	}

	pool.query(query, queryParams, function(err, rows) {
		if (err) {
			console.error(err);
			res.status(500).send(err.toString());
		} else {
			res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
			let body = '<?xml-stylesheet href="/static/result.css"?>\n';
			body += '<testsuite>';
			for (let i = 0; i < rows.length; i++) {
				body += rows[i].result;
				body += '</testsuite>';
			}
			res.status(200).send(body);
		}
	});
}

function resultWebCallback(req, res, err, row) {
	if (err) {
		console.error(err);
		res.status(500).send(err.toString());
	} else if (row && row.length > 0) {
		if (row[0].result.match(/<testsuite/)) {
			res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
			res.status(200);
			res.write('<?xml-stylesheet href="/static/result.css"?>\n');
		}
		res.end(row[0].result);
	} else {
		res.status(200).send('no results for that page at the requested revision');
	}
}

function resultWebInterface(req, res) {
	const commit = req.params[2] ? req.params[0] : null;
	const title = commit === null ? req.params[1] : req.params[2];
	const prefix = commit === null ? req.params[0] : req.params[1];

	if (commit !== null) {
		pool.query(dbGetResultWithCommit, [ commit, title, prefix ], resultWebCallback.bind(null, req, res));
	} else {
		pool.query(dbGetOneResult, [ title, prefix ], resultWebCallback.bind(null, req, res));
	}
}

function getFailedFetches(req, res) {
	pool.query(dbFailedFetches, [maxFetchRetries], function(err, rows) {
		if (err) {
			console.error(err);
			res.status(500).send(err.toString());
		} else {
			res.status(200);
			const n = rows.length;
			const pageData = [];
			for (let i = 0; i < n; i++) {
				const prefix = rows[i].prefix;
				const title = rows[i].title;
				const name = prefix + ':' + title;
				pageData.push({
					url: prefix.replace(/wiki$/, '') + '.wikipedia.org/wiki/' + title,
					linkName: name.replace('&', '&amp;'),
				});
			}
			const heading = n === 0 ? 'No titles returning 404!  All\'s well with the world!' :
				'The following ' + n + ' titles return 404';
			const data = {
				alt: n === 0,
				heading: heading,
				items: pageData,
			};
			res.render('list.html', data);
		}
	});
}

function getCrashers(req, res) {
	const cutoffDate = new Date(Date.now() - (cutOffTime * 1000));
	pool.query(dbCrashers, [ maxTries, cutoffDate ], function(err, rows) {
		if (err) {
			console.error(err);
			res.status(500).send(err.toString());
		} else {
			res.status(200);
			const n = rows.length;
			const pageData = [];
			for (let i = 0; i < n; i++) {
				const prefix = rows[i].prefix;
				const title = rows[i].title;
				pageData.push({
					description: rows[i].claim_hash,
					url: prefix.replace(/wiki$/, '') + '.wikipedia.org/wiki/' + title,
					linkName: prefix + ':' + title,
				});
			}
			const heading = n === 0 ? 'No titles crash the testers! All\'s well with the world!' :
				'The following ' + n + ' titles crash the testers at least ' +
				maxTries + ' times ';
			const data = {
				alt: n === 0,
				heading: heading,
				items: pageData,
			};
			res.render('list.html', data);
		}
	});
}

function getFailsDistr(req, res) {
	pool.query(dbFailsDistribution, null, function(err, rows) {
		if (err) {
			console.error(err);
			res.status(500).send(err.toString());
		} else {
			res.status(200);
			const n = rows.length;
			const intervalData = [];
			for (let i = 0; i < n; i++) {
				const r = rows[i];
				intervalData.push({ errors: r.fails, pages: r.num_pages });
			}
			const data = {
				heading: 'Distribution of semantic errors',
				interval: intervalData,
			};
			res.render('histogram.html', data);
		}
	});
}

function getSkipsDistr(req, res) {
	pool.query(dbSkipsDistribution, null, function(err, rows) {
		if (err) {
			console.error(err);
			res.status(500).send(err.toString());
		} else {
			res.status(200);
			const n = rows.length;
			const intervalData = [];
			for (let i = 0; i < n; i++) {
				const r = rows[i];
				intervalData.push({ errors: r.skips, pages: r.num_pages });
			}
			const data = {
				heading: 'Distribution of syntactic errors',
				interval: intervalData,
			};
			res.render('histogram.html', data);
		}
	});
}

function getRegressions(req, res) {
	const r1 = req.params[0];
	const r2 = req.params[1];
	const page = (req.params[2] || 0) - 0;
	const offset = page * 40;
	const relativeUrlPrefix = '../../../';
	relativeUrlPrefix = relativeUrlPrefix + (req.params[0] ? '../' : '');
	pool.query(dbNumRegressionsBetweenRevs, [ r2, r1 ], function(err, row) {
		if (err) {
			res.status(500).send(err.toString());
		} else {
			const data = {
				page: page,
				relativeUrlPrefix: relativeUrlPrefix,
				urlPrefix: relativeUrlPrefix + 'regressions/between/' + r1 + '/' + r2,
				urlSuffix: '',
				heading: "Total regressions between selected revisions: " +
					row[0].numRegressions,
				headingLink: [{ url: relativeUrlPrefix + 'topfixes/between/' + r1 + '/' + r2, name: 'topfixes' }],
				header: RH.regressionsHeaderData,
			};
			pool.query(dbRegressionsBetweenRevs, [ r2, r1, offset ],
				RH.displayPageList.bind(null, res, data, RH.makeRegressionRow));
		}
	});
}

function getTopfixes(req, res) {
	const r1 = req.params[0];
	const r2 = req.params[1];
	const page = (req.params[2] || 0) - 0;
	const offset = page * 40;
	const relativeUrlPrefix = '../../../';
	relativeUrlPrefix = relativeUrlPrefix + (req.params[0] ? '../' : '');
	pool.query(dbNumFixesBetweenRevs, [ r2, r1 ], function(err, row) {
		if (err) {
			res.status(500).send(err.toString());
		} else {
			const data = {
				page: page,
				relativeUrlPrefix: relativeUrlPrefix,
				urlPrefix: relativeUrlPrefix + 'topfixes/between/' + r1 + '/' + r2,
				urlSuffix: '',
				heading: 'Total fixes between selected revisions: ' + row[0].numFixes,
				headingLink: [{ url: relativeUrlPrefix + "regressions/between/" + r1 + "/" + r2, name: 'regressions' }],
				header: RH.regressionsHeaderData,
			};
			pool.query(dbFixesBetweenRevs, [ r2, r1, offset ],
				RH.displayPageList.bind(null, res, data, RH.makeRegressionRow));
		}
	});
}

function getCommits(req, res) {
	pool.query(dbCommits, null, function(err, rows) {
		if (err) {
			console.error(err);
			res.status(500).send(err.toString());
		} else {
			res.status(200);
			const n = rows.length;
			const tableRows = [];
			for (let i = 0; i < n; i++) {
				const row = rows[i];
				const tableRow = { hash: row.hash, timestamp: row.timestamp };
				if (i + 1 < n) {
					tableRow.regUrl = 'regressions/between/' + rows[i + 1].hash + '/' + row.hash;
					tableRow.fixUrl = 'topfixes/between/' + rows[i + 1].hash + '/' + row.hash;
				}
				tableRows.push(tableRow);
			}
			const data = {
				numCommits: n,
				latest: n ? rows[n - 1].timestamp.toString().slice(4, 15) : '',
				header: ['Commit hash', 'Timestamp', 'Tests', '-', '+'],
				row: tableRows,
			};

			res.render('commits.html', data);
		}
	});
}

function diffResultWebCallback(req, res, flag, err, row) {
	if (err) {
		console.error(err);
		res.status(500).send(err.toString());
	} else if (row.length === 2) {
		const oldCommit = req.params[0].slice(0, 10);
		const newCommit = req.params[1].slice(0, 10);
		const oldResult = row[0].result;
		const newResult = row[1].result;
		const flagResult = Diff.resultFlagged(oldResult, newResult, oldCommit, newCommit, flag);
		res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
		res.status(200);
		res.write('<?xml-stylesheet href="/static/result.css"?>\n');
		res.end(flagResult);
	} else {
		const commit = flag === '+' ? req.params[1] : req.params[0];
		res.redirect('/result/' + commit + '/' + encodeURIComponent(req.params[2]) + '/' + encodeURIComponent(req.params[3]));
	}
}

function resultFlagNewWebInterface(req, res) {
	const oldCommit = req.params[0];
	const newCommit = req.params[1];
	const prefix = req.params[2];
	const title = req.params[3];

	pool.query(dbGetTwoResults, [ title, prefix, oldCommit, newCommit ],
		diffResultWebCallback.bind(null, req, res, '+'));
}

function resultFlagOldWebInterface(req, res) {
	const oldCommit = req.params[0];
	const newCommit = req.params[1];
	const prefix = req.params[2];
	const title = req.params[3];

	pool.query(dbGetTwoResults, [ title, prefix, oldCommit, newCommit ],
		diffResultWebCallback.bind(null, req, res, '-'));
}

const startCoordApp = Promise.method(function() {
	// Make the coordinator app
	const coordApp = express();

	// application/x-www-form-urlencoded
	// multipart/form-data
	coordApp.use(busboy({
		limits: {
			fields: 10,
			fieldSize: 1000000,
		},
	}));

	// application/json
	coordApp.use(bodyParser.json({
		limit: 100000,
	}));

	coordApp.use(function(req, res, next) {
		req.body = req.body || {};
		if (!req.busboy) {
			return next();
		}
		req.busboy.on('field', function(field, val) {
			req.body[field] = val;
		});
		req.busboy.on('finish', function() {
			next();
		});
		req.pipe(req.busboy);
	});

	// Clients will GET this path if they want to run a test
	coordApp.get(/^\/title$/, getTitle);

	// Receive results from clients
	coordApp.post(/^\/result\/([^\/]+)\/([^\/]+)/, receiveResults);

	let rtResultsServer;
	return new Promise(function(resolve) {
		rtResultsServer = coordApp.listen(settings.coordPort || 8002, process.env.INTERFACE, resolve);
	}).then(function() {
		console.log('RT test server listening on: %s', rtResultsServer.address().port);
		return rtResultsServer;
	});
});

const startWebServer = Promise.method(function() {
	// Make an app
	const app = express();

	// Declare static directory
	app.use("/static", express.static(__dirname + "/static"));

	// Add in the bodyParser middleware (because it's pretty standard)
	app.use(bodyParser.json({}));

	// robots.txt: no indexing.
	app.get(/^\/robots\.txt$/, function(req, res) {
		res.end("User-agent: *\nDisallow: /\n");
	});

	// Main interface
	app.get(/^\/results(\/([^\/]+))?$/, resultsWebInterface);

	// Results for a title (on latest commit)
	app.get(/^\/latestresult\/([^\/]+)\/(.*)$/, resultWebInterface);

	// Results for a title on any commit
	app.get(/^\/result\/([\w\-_]*)\/([^\/]+)\/(.*)$/, resultWebInterface);

	// List of failures sorted by severity
	app.get(/^\/topfails\/(\d+)$/, failsWebInterface);
	// 0th page
	app.get(/^\/topfails$/, failsWebInterface);

	// Overview of stats
	app.get(/^\/$/, statsWebInterface);
	app.get(/^\/stats(\/([^\/]+))?$/, statsWebInterface);

	// Failed fetches
	app.get(/^\/failedFetches$/, getFailedFetches);

	// Crashers
	app.get(/^\/crashers$/, getCrashers);

	// Regressions between two revisions.
	app.get(/^\/regressions\/between\/([^\/]+)\/([^\/]+)(?:\/(\d+))?$/, getRegressions);

	// Topfixes between two revisions.
	app.get(/^\/topfixes\/between\/([^\/]+)\/([^\/]+)(?:\/(\d+))?$/, getTopfixes);

	// Results for a title on a commit, flag skips/fails new since older commit
	app.get(/^\/resultFlagNew\/([\w\-_]*)\/([\w\-_]*)\/([^\/]+)\/(.*)$/, resultFlagNewWebInterface);

	// Results for a title on a commit, flag skips/fails no longer in newer commit
	app.get(/^\/resultFlagOld\/([\w\-_]*)\/([\w\-_]*)\/([^\/]+)\/(.*)$/, resultFlagOldWebInterface);

	// Distribution of fails
	app.get(/^\/semanticDiffsDistr$/, getFailsDistr);

	// Distribution of fails
	app.get(/^\/syntacticDiffsDistr$/, getSkipsDistr);

	// List of all commits
	app.get('/commits', getCommits);

	// view engine
	const ve = ehbs.create({
		defaultLayout: 'layout',
		layoutsDir: path.join(__dirname, '/views'),
		extname: '.html',
		helpers: {
			// block helper to reference js files in page head.
			jsFiles: function(options) {
				this.javascripts = options.fn(this);
				return null;
			},

			formatPerfStat: function(type, value) {
				if (type.match(/^time/)) {
					// Show time in seconds
					value = Math.round((value / 1000) * 100) / 100;
					return value.toString() + "s";
				} else if (type.match(/^size/)) {
					// Show sizes in KiB
					value = Math.round(value / 1024);
					return value.toString() + "KiB";
				} else {
					// Other values go as they are
					return value.toString();
				}
			},

			// round numeric data, but ignore others
			round: function(val) {
				if (isNaN(val)) {
					return val;
				} else {
					return Math.round(val * 100) / 100;
				}
			},

			formatHash: function(hash) {
				return hash;
			},

			formatDate: function(timestamp) {
				return timestamp.toString().slice(4, 21);
			},

			formatUrl: function(url) {
				return 'http://' + encodeURI(url).replace('&', '&amp;');
			},

			prevUrl: function(urlPrefix, urlSuffix, page) {
				return (urlPrefix ? urlPrefix + "/" : "") + (page - 1) + urlSuffix;
			},

			nextUrl: function(urlPrefix, urlSuffix, page) {
				return (urlPrefix ? urlPrefix + "/" : "") + (page + 1) + urlSuffix;
			},
		},
	});

	app.set('views', path.join(__dirname, '/views'));
	app.set('view engine', 'html');
	app.engine('html', ve.engine);

	if (parsoidRTConfig) {
		parsoidRTConfig.setupEndpoints(settings, app, mysql, pool, ve.handlebars);
	}

	if (perfConfig) {
		perfConfig.setupEndpoints(settings, app, mysql, pool);
	}

	let webServer;
	return new Promise(function(resolve) {
		webServer = app.listen(settings.webappPort || 8001, process.env.INTERFACE, resolve);
	}).then(function() {
		console.log('Testreduce server listening on: %s', webServer.address().port);
		return webServer;
	});
});

startCoordApp().then(startWebServer).catch(function(e) {
	console.log('Error starting up: ' + e);
	console.log(e.stack);
});

module.exports = {};
