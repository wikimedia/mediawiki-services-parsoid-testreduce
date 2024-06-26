"use strict";

const RH = require('./render.helpers.js').RenderHelpers;

const dbInsertPerfStatsStart =
	'INSERT INTO perfstats ' +
	'( page_id, commit_hash, type, value ) VALUES ';
const dbInsertPerfStatsEnd =
	' ON DUPLICATE KEY UPDATE value = VALUES( value )';

const dbPerfStatsTypes =
	'SELECT DISTINCT type FROM perfstats';

const dbLastPerfStatsStart =
	'SELECT prefix, title, ';

const dbLastPerfStatsEnd =
	' FROM pages JOIN perfstats ON pages.id = perfstats.page_id ' +
	'WHERE perfstats.commit_hash = ' +
		'(SELECT hash FROM commits ORDER BY timestamp DESC LIMIT 1) ' +
	'GROUP BY pages.id ';

const dbPagePerfStatsStart =
	'SELECT commits.hash, commits.timestamp, ';

const dbPagePerfStatsEnd =
	' FROM (perfstats JOIN pages ON perfstats.page_id = pages.id) ' +
	'JOIN commits ON perfstats.commit_hash = commits.hash ' +
	'WHERE pages.prefix = ? AND pages.title = ? ' +
	'GROUP BY commits.hash ' +
	'ORDER BY commits.timestamp DESC ' +
	'LIMIT 0, ?';

let cachedPerfStatsTypes;

const perfStatsTypes = function(db, cb) {
	if (cachedPerfStatsTypes) {
		return cb(null, cachedPerfStatsTypes);
	}
	// As MySQL doesn't support PIVOT, we need to get all the perfstats types
	// first so we can get then as columns afterwards
	db.query(dbPerfStatsTypes, null, function(err, rows) {
		if (err) {
			cb(err, null);
		} else if (!rows || rows.length === 0) {
			cb("No performance stats found", null);
		} else {
			const types = [];
			for (let i = 0; i < rows.length; i++) {
				types.push(rows[i].type);
			}

			// Sort the profile types by name
			types.sort();
			cachedPerfStatsTypes = types;

			cb(null, types);
		}
	});
};

const parsePerfStats = function(text) {
	const regexp = /<perfstat[\s]+type="([\w\:]+)"[\s]*>([\d]+)/g;
	const perfstats = [];
	for (let match = regexp.exec(text); match !== null; match = regexp.exec(text)) {
		perfstats.push({ type: match[ 1 ], value: match[ 2 ] });
	}
	return perfstats;
};

const insertPerfStats = function(db, pageId, commitHash, perfstats, cb) {
	// If empty, just return
	if (!perfstats || perfstats.length === 0) {
		if (cb) {
			return cb(null, null);
		}
		return;
	}
	// Build the query to insert all the results in one go:
	let dbStmt = dbInsertPerfStatsStart;
	for (let i = 0; i < perfstats.length; i++) {
		if (i !== 0) {
			dbStmt += ", ";
		}
		dbStmt += "( " + pageId.toString() + ", '" + commitHash + "', '" +
			perfstats[i].type + "', " + perfstats[i].value + ' )';
	}
	dbStmt += dbInsertPerfStatsEnd;

	// Make the query using the db arg, which could be a transaction
	db.query(dbStmt, null, cb);
};

function updateIndexPageUrls(list) {
	list.push({ url: '/perfstats', title: 'Performance stats of last commit' });
}

function updateTitleData(data, prefix, title) {
	data.perf = '/pageperfstats/' + prefix + '/' + title;
}

function setupEndpoints(settings, app, mysql, db) {
	// SSS FIXME: this is awkward
	RH.settings = settings;
	const getPerfStats = function(req, res) {
		const page = (req.params[0] || 0) - 0;
		const offset = page * 40;
		let orderBy = 'prefix ASC, title ASC';
		let urlSuffix = '';

		if (req.query.orderby) {
			orderBy = mysql.escapeId(req.query.orderby) + ' DESC';
			urlSuffix = '?orderby=' + req.query.orderby;
		}

		perfStatsTypes(db, function(err, types) {
			if (err) {
				res.status(500).send(err.toString());
			} else {

				const makePerfStatRow = function(urlPrefix, row) {
					const result = [RH.pageTitleData(urlPrefix, row)];
					for (let j = 0; j < types.length; j++) {
						const type = types[j];
						const rowData = row[type] === null ? '' :
							{ type: type, value: row[type], info: row[type] };
						result.push(rowData);
					}
					return result;
				};

				// Create the query to retrieve the stats per page
				const perfStatsHeader = ['Title'];
				let dbStmt = dbLastPerfStatsStart;
				for (let t = 0; t < types.length; t++) {
					if (t !== 0) {
						dbStmt += ", ";
					}
					dbStmt += "SUM( IF( TYPE='" + types[ t ] +
						"', value, NULL ) ) AS '" + types[ t ] + "'";
					perfStatsHeader.push({
						url: '/perfstats?orderby=' + types[t],
						name: types[t],
					});
				}
				dbStmt += dbLastPerfStatsEnd;
				dbStmt += 'ORDER BY ' + orderBy;
				dbStmt += ' LIMIT 40 OFFSET ' + offset.toString();

				const relativeUrlPrefix = (req.params[0] ? '../' : '');
				const data = {
					page: page,
					relativeUrlPrefix: relativeUrlPrefix,
					urlPrefix: relativeUrlPrefix + 'perfstats',
					urlSuffix: urlSuffix,
					heading: 'Performance stats',
					header: perfStatsHeader,
				};

				db.query(dbStmt, null,
					RH.displayPageList.bind(null, res, data, makePerfStatRow));
			}
		});
	};

	const getPagePerfStats = function(req, res) {
		if (req.params.length < 2) {
			res.status(404).send("No title given.");
		}

		const prefix = req.params[0];
		const title = req.params[1];

		perfStatsTypes(db, function(err, types) {
			if (err) {
				res.status(500).send(err.toString());
			} else {
				let dbStmt = dbPagePerfStatsStart;
				for (let t = 0; t < types.length; t++) {
					if (t !== 0) {
						dbStmt += ", ";
					}

					dbStmt += "SUM( IF( type='" + types[t] +
						"', value, NULL ) ) AS '" + types[ t ] + "'";
				}
				dbStmt += dbPagePerfStatsEnd;

				// Get maximum the last 10 commits.
				db.query(dbStmt, [ prefix, title, 10 ], function(err2, rows) {
					if (err2) {
						res.status(500).send(err2.toString());
					} else if (!rows || rows.length === 0) {
						res.status(200).send("No performance results found for page.");
					} else {
						res.status(200);
						const tableHeaders = ['Commit'];
						for (let t = 0; t < types.length; t++) {
							tableHeaders.push(types[t]);
						}

						// Show the results in order of timestamp.
						const tableRows = [];
						for (let r = rows.length - 1; r >= 0; r--) {
							const row = rows[r];
							const tableRow = [
								{
									url: '/result/' + row.hash + '/' + prefix + '/' + title,
									name: row.hash,
									info: row.timestamp.toString(),
								},
							];
							for (let t = 0; t < types.length; t++) {
								const rowData = row[types[t]] === null ? '' :
									{ type: types[t], value: row[types[t]], info: row[types[t]] };
								tableRow.push(rowData);
							}
							tableRows.push({ tableData: tableRow });
						}

						const data = {
							heading: 'Performance results for ' + prefix + ':' + title,
							header: tableHeaders,
							row: tableRows,
						};
						res.render('table.html', data);
					}
				});
			}
		});
	};

	// Performance stats
	app.get(/^\/perfstats\/(\d+)$/, getPerfStats);
	app.get(/^\/perfstats$/, getPerfStats);
	app.get(/^\/pageperfstats\/([^\/]+)\/(.*)$/, getPagePerfStats);
}

if (typeof module === "object") {
	module.exports.perfConfig = {
		parsePerfStats: parsePerfStats,
		insertPerfStats: insertPerfStats,
		setupEndpoints: setupEndpoints,
		updateIndexPageUrls: updateIndexPageUrls,
		updateIndexData: function() {}, // Nothing to do
		updateTitleData: updateTitleData,
	};
}
