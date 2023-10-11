"use strict";

const RenderHelpers = {};
const RH = RenderHelpers;

RenderHelpers.pageTitleData = function(urlPrefix, row) {
	const settings = RH.settings;
	const wiki = encodeURIComponent(row.prefix);
	const title = encodeURIComponent(row.title);

	const data = {
		title: row.prefix + ':' + row.title,
		latest: urlPrefix + 'latestresult/' + wiki + '/' + title,
	};

	if (settings.resultServer) {
		data.remoteUrl = settings.generateTitleUrl(settings.resultServer, wiki, title);
	}

	if (settings.localhostServer) {
		data.lhUrl = settings.generateTitleUrl(settings.localhostServer, wiki, title);
	}

	// Let each of the "plugins" to do their thing
	if (settings.perfConfig) {
		settings.perfConfig.updateTitleData(data, wiki, title);
	}
	if (settings.parsoidRTConfig) {
		settings.parsoidRTConfig.updateTitleData(data, wiki, title);
	}

	return data;
};

RenderHelpers.commitLinkData = function(urlPrefix, commit, title, wiki) {
	return {
		url: urlPrefix + 'result/' + commit + '/' + wiki + '/' + title,
		name: commit.slice(0, 16),
	};
};

RenderHelpers.newCommitLinkData = function(urlPrefix, oldCommit, newCommit, title, prefix) {
	return {
		url: urlPrefix + 'resultFlagNew/' + oldCommit + '/' + newCommit + '/' + prefix + '/' + title,
		name: newCommit.slice(0, 16),
	};
};

RenderHelpers.oldCommitLinkData = function(urlPrefix, oldCommit, newCommit, title, prefix) {
	return {
		url: urlPrefix + 'resultFlagOld/' + oldCommit + '/' + newCommit + '/' + prefix + '/' + title,
		name: oldCommit.slice(0, 16),
	};
};

RenderHelpers.regressionsHeaderData = ['Title', 'Old Commit', 'Errors|Semantic|Syntactic', 'New Commit', 'Errors|Semantic|Syntactic'];

RenderHelpers.makeRegressionRow = function(urlPrefix, row) {
	return [
		RH.pageTitleData(urlPrefix, row),
		RH.oldCommitLinkData(urlPrefix, row.old_commit, row.new_commit, row.title, row.prefix),
		row.old_errors + "|" + row.old_fails + "|" + row.old_skips,
		RH.newCommitLinkData(urlPrefix, row.old_commit, row.new_commit, row.title, row.prefix),
		row.errors + "|" + row.fails + "|" + row.skips,
	];
};

RenderHelpers.pageStatus = function(row) {
	const hasStatus = row.hasOwnProperty('skips') &&
		row.hasOwnProperty('fails') &&
		row.hasOwnProperty('errors');

	if (hasStatus) {
		if (row.skips === 0 && row.fails === 0 && row.errors === 0) {
			return 'perfect';
		} else if (row.errors > 0 || row.fails > 0) {
			return 'fail';
		} else {
			return 'skip';
		}
	}
	return null;
};

RenderHelpers.displayPageList = function(res, data, makeRow, err, rows) {
	console.log("GET " + data.urlPrefix + "/" + data.page + data.urlSuffix);
	if (err) {
		res.send(err.toString(), 500);
	} else {
		res.status(200);
		const tableData = data;
		if (rows.length === 0) {
			tableData.header = undefined;
		} else {
			const tableRows = [];
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				const tableRow = { status: RH.pageStatus(row), tableData: makeRow(data.relativeUrlPrefix, row) };
				tableRows.push(tableRow);
			}
			tableData.paginate = true;
			tableData.row = tableRows;
			tableData.prev = data.page > 0;
			tableData.next = rows.length === 40;
		}
		res.render('table.html', tableData);
	}
};

if (typeof module === "object") {
	module.exports.RenderHelpers = RenderHelpers;
}
