"use strict";

const RH = require('./render.helpers.js').RenderHelpers;
const fs = require('fs');

const dbPagesWithRTSelserErrors =
	'SELECT pages.title, pages.prefix, commits.hash, ' +
	'stats.errors, stats.fails, stats.skips, stats.selser_errors ' +
	'FROM stats ' +
	'JOIN pages ON stats.page_id = pages.id ' +
	'JOIN commits ON stats.commit_hash = commits.hash ' +
	'WHERE commits.hash = ? AND ' +
		'stats.selser_errors > 0 ' +
	'ORDER BY stats.score DESC ' +
	'LIMIT 40 OFFSET ?';

const dbNumOneDiffRegressionsBetweenRevs =
	'SELECT count(*) AS numFlaggedRegressions ' +
	'FROM pages ' +
	'JOIN stats AS s1 ON s1.page_id = pages.id ' +
	'JOIN stats AS s2 ON s2.page_id = pages.id ' +
	'WHERE s1.commit_hash = ? AND s2.commit_hash = ? AND s1.score > s2.score ' +
		'AND s2.fails = 0 AND s2.skips = 0 ' +
		'AND s1.fails = ? AND s1.skips = ? ';

const dbOneDiffRegressionsBetweenRevs =
	'SELECT pages.title, pages.prefix, ' +
	's1.commit_hash AS new_commit, ' +
	's2.commit_hash AS old_commit ' +
	'FROM pages ' +
	'JOIN stats AS s1 ON s1.page_id = pages.id ' +
	'JOIN stats AS s2 ON s2.page_id = pages.id ' +
	'WHERE s1.commit_hash = ? AND s2.commit_hash = ? AND s1.score > s2.score ' +
		'AND s2.fails = 0 AND s2.skips = 0 ' +
		'AND s1.fails = ? AND s1.skips = ? ' +
	'ORDER BY s1.score - s2.score DESC ' +
	'LIMIT 40 OFFSET ?';

const dbNumNewFailsRegressionsBetweenRevs =
	'SELECT count(*) AS numFlaggedRegressions ' +
	'FROM pages ' +
	'JOIN stats AS s1 ON s1.page_id = pages.id ' +
	'JOIN stats AS s2 ON s2.page_id = pages.id ' +
	'WHERE s1.commit_hash = ? AND s2.commit_hash = ? AND s1.score > s2.score ' +
		'AND s2.fails = 0 AND s1.fails > 0 ' +
		// exclude cases introducing exactly one skip/fail to a perfect
		'AND (s1.skips > 0 OR s1.fails <> 1 OR s2.skips > 0)';

const dbNewFailsRegressionsBetweenRevs =
	'SELECT pages.title, pages.prefix, ' +
	's1.commit_hash AS new_commit, s1.errors AS errors, s1.fails AS fails, s1.skips AS skips, ' +
	's2.commit_hash AS old_commit, s2.errors AS old_errors, s2.fails AS old_fails, s2.skips AS old_skips ' +
	'FROM pages ' +
	'JOIN stats AS s1 ON s1.page_id = pages.id ' +
	'JOIN stats AS s2 ON s2.page_id = pages.id ' +
	'WHERE s1.commit_hash = ? AND s2.commit_hash = ? AND s1.score > s2.score ' +
		'AND s2.fails = 0 AND s1.fails > 0 ' +
		// exclude cases introducing exactly one skip/fail to a perfect
		'AND (s1.skips > 0 OR s1.fails <> 1 OR s2.skips > 0) ' +
	'ORDER BY s1.score - s2.score DESC ' +
	'LIMIT 40 OFFSET ?';

const makeOneDiffRegressionRow = function(urlPrefix, row) {
	return [
		RH.pageTitleData(urlPrefix, row),
		RH.oldCommitLinkData(urlPrefix, row.old_commit, row.new_commit, row.title, row.prefix),
		RH.newCommitLinkData(urlPrefix, row.old_commit, row.new_commit, row.title, row.prefix),
	];
};

function parseSelserStats(result) {
	let selserErrorCount = 0;
	const selserSuites = result.match(/<testsuite[^>]*\(selser\)[^>]*>[\s\S]*?<\/testsuite>/g);
	for (const selserSuite in selserSuites) {
		const matches = selserSuites[selserSuite].match(/<testcase/g);
		selserErrorCount += matches ? matches.length : 0;
	}

	return selserErrorCount;
}

function updateIndexData(data, row) {
	data.latestRevision.push({
		description: 'RT selser errors',
		value: row[0].rtselsererrors,
		url: '/rtselsererrors/' + row[0].maxhash,
	});

	data.flaggedReg = [
		{
			description: 'one fail',
			info: 'one new semantic diff, previously perfect',
			url: 'onefailregressions/between/' + row[0].secondhash + '/' + row[0].maxhash,
		},
		{
			description: 'one skip',
			info: 'one new syntactic diff, previously perfect',
			url: 'oneskipregressions/between/' + row[0].secondhash + '/' + row[0].maxhash,
		},
		{
			description: 'other new fails',
			info: 'other cases with semantic diffs, previously only syntactic diffs',
			url: 'newfailsregressions/between/' + row[0].secondhash + '/' + row[0].maxhash,
		},
	];
}

function setupEndpoints(settings, app, mysql, db, hbs) {
	// SSS FIXME: this is awkward
	RH.settings = settings;
	const displayOneDiffRegressions = function(numFails, numSkips, subheading, headingLinkData, req, res) {
		const r1 = req.params[0];
		const r2 = req.params[1];
		const page = (req.params[2] || 0) - 0;
		const offset = page * 40;
		const relativeUrlPrefix = '../../../';
		db.query(dbNumOneDiffRegressionsBetweenRevs, [r2, r1, numFails, numSkips], function(err, row) {
			if (err) {
				res.send(err.toString(), 500);
			} else {
				const headingLink = [
					{
						name: headingLinkData[2],
						info: headingLinkData[1],
						url: relativeUrlPrefix + headingLinkData[3] + 'regressions/between/' + r1 + '/' + r2,
					},
					{
						name: 'other new fails',
						info: 'other cases with semantic diffs, previously only syntactic diffs',
						url: relativeUrlPrefix + 'newfailsregressions/between/' + r1 + '/' + r2,
					},
				];
				const data = {
					page: page,
					relativeUrlPrefix: relativeUrlPrefix,
					urlPrefix: relativeUrlPrefix + headingLinkData[0] + 'regressions/between/' + r1 + '/' + r2,
					urlSuffix: '',
					heading: 'Flagged regressions between selected revisions: ' +
						row[0].numFlaggedRegressions,
					subheading: subheading,
					headingLink: headingLink,
					header: ['Title', 'Old Commit', 'New Commit'],
				};
				db.query(dbOneDiffRegressionsBetweenRevs, [r2, r1, numFails, numSkips, offset],
					RH.displayPageList.bind(null, res, data, makeOneDiffRegressionRow));
			}
		});
	};

	const getRtselsererrors = function(req, res) {
		const commit = req.params[0];
		const page = (req.params[1] || 0) - 0;
		const offset = page * 40;
		const relativeUrlPrefix = (req.params[1] ? '../../' : '../');
		const data = {
			page: page,
			relativeUrlPrefix: relativeUrlPrefix,
			urlPrefix: relativeUrlPrefix + 'rtselsererrors/' + commit,
			urlSuffix: '',
			heading: 'Pages with rt selser errors',
			header: ['Title', 'Commit', 'Syntactic diffs', 'Semantic diffs', 'Errors'],
		};
		const makeSelserErrorRow = function(urlPrefix, row) {
			const prefix = encodeURIComponent(row.prefix);
			const title = encodeURIComponent(row.title);

			const rowData = {
				title: row.prefix + ':' + row.title,
				latest: 'latestresult/' + prefix + '/' + title,
				perf: 'pageperfstats/' + prefix + '/' + title,
			};

			if (RH.settings.resultServer) {
				rowData.remoteUrl = RH.settings.resultServer + '_rtselser/' + prefix + '/' + title;
			}
			if (RH.settings.localhostServer) {
				rowData.lhUrl = RH.settings.localhostServer + '/_rtselser/' + prefix + '/' + title;
			}

			return [
				rowData,
				RH.commitLinkData(urlPrefix, row.hash, row.title, row.prefix),
				row.skips,
				row.fails,
				row.errors === null ? 0 : row.errors,
			];
		};
		db.query(dbPagesWithRTSelserErrors, [commit, offset],
			RH.displayPageList.bind(null, res, data, makeSelserErrorRow));
	};

	const getOneFailRegressions = displayOneDiffRegressions.bind(
		null, 1, 0, 'Old Commit: perfect | New Commit: one semantic diff',
		['onefail', 'one new syntactic diff, previously perfect', 'one skip regressions', 'oneskip']
	);

	const getOneSkipRegressions = displayOneDiffRegressions.bind(
		null, 0, 1, 'Old Commit: perfect | New Commit: one syntactic diff',
		['oneskip', 'one new semantic diff, previously perfect', 'one fail regressions', 'onefail']
	);

	const getNewFailsRegressions = function(req, res) {
		const r1 = req.params[0];
		const r2 = req.params[1];
		const page = (req.params[2] || 0) - 0;
		const offset = page * 40;
		const relativeUrlPrefix = '../../../';
		db.query(dbNumNewFailsRegressionsBetweenRevs, [r2, r1], function(err, row) {
			if (err) {
				res.send(err.toString(), 500);
			} else {
				const data = {
					page: page,
					relativeUrlPrefix: relativeUrlPrefix,
					urlPrefix: relativeUrlPrefix + 'regressions/between/' + r1 + '/' + r2,
					urlSuffix: '',
					heading: 'Flagged regressions between selected revisions: ' +
						row[0].numFlaggedRegressions,
					subheading: 'Old Commit: only syntactic diffs | New Commit: semantic diffs',
					headingLink: [
						{
							name: 'one fail regressions',
							info: 'one new semantic diff, previously perfect',
							url: relativeUrlPrefix + 'onefailregressions/between/' + r1 + '/' + r2,
						},
						{
							name: 'one skip regressions',
							info: 'one new syntactic diff, previously perfect',
							url: relativeUrlPrefix + 'oneskipregressions/between/' + r1 + '/' + r2,
						},
					],
					header: RH.regressionsHeaderData,
				};
				db.query(dbNewFailsRegressionsBetweenRevs, [r2, r1, offset],
					RH.displayPageList.bind(null, res, data, RH.makeRegressionRow));
			}
		});
	};

	// Regressions between two revisions that introduce one semantic error to a perfect page.
	app.get(/^\/onefailregressions\/between\/([^\/]+)\/([^\/]+)(?:\/(\d+))?$/, getOneFailRegressions);

	// Regressions between two revisions that introduce one syntactic error to a perfect page.
	app.get(/^\/oneskipregressions\/between\/([^\/]+)\/([^\/]+)(?:\/(\d+))?$/, getOneSkipRegressions);

	// Regressions between two revisions that introduce senantic errors (previously only syntactic diffs).
	app.get(/^\/newfailsregressions\/between\/([^\/]+)\/([^\/]+)(?:\/(\d+))?$/, getNewFailsRegressions);

	// Pages with rt selser errors
	app.get(/^\/rtselsererrors\/([^\/]+)(?:\/(\d+))?$/, getRtselsererrors);

	hbs.registerPartial('summary', fs.readFileSync(__dirname + '/views/index-summary-rt.html', 'utf8'));
}

if (typeof module === "object") {
	module.exports.parsoidRTConfig = {
		parseSelserStats: parseSelserStats,
		setupEndpoints: setupEndpoints,
		updateIndexPageUrls: function() {}, // Nothing to do
		updateIndexData: updateIndexData,
		updateTitleData:  function() {}, // Nothing to do
	};
}
