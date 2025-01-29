#!/usr/bin/env node

'use strict';
const fs = require('fs');
const request = require('request');
const testdb = require('./testdb.info.js');
const wikis = testdb.wikis;

function processRes(fetchArgs, out, err, resp, body) {
	if (err || resp.statusCode !== 200) {
		console.error("URI: " + fetchArgs.uri);
		if (err) {
			console.error('Error: ' + err);
		}
		if (resp) {
			console.error('Status code: ' + resp.statusCode);
		}
		return;
	}

	const titles = [];
	const res = JSON.parse(body);
	const articles = res.items[0].articles;
	const n = fetchArgs.count < articles.length ? fetchArgs.count : articles.length;
	for (let i = 0; i < n; i++) {
		titles.push(articles[i].article);
	}

	const fileName = './dbdata/' + fetchArgs.prefix + '.top_titles.txt';
	console.warn('Got ' + titles.length + ' top-ranked titles from ' + fetchArgs.prefix + '; writing to ' + fileName);
	fs.writeFileSync(fileName, titles.join('\n'));
}

function fetchAll(fetchArgs, out) {
	const n = fetchArgs.count;
	const requestOpts = { method: 'GET', uri: fetchArgs.uri };
	console.log('Fetching ' + n + ' results from ' + fetchArgs.prefix);
	request(requestOpts, processRes.bind(null, fetchArgs, out));
}

// +0.01 is so we fetch a few extra titles to account for the title overlap
// between the different lists
const sum = wikis.reduce(function(s, w) {
	return s + w.limit;
}, 0);
const fraction = testdb.popular_pages_percentage / 100 + 0.01;
wikis.forEach(function(obj) {
	const isTalk = obj.ns === 1;
	if (isTalk) {
		return;
	}
	const count = Math.ceil(obj.limit / sum * fraction * testdb.size);
	const prefix = obj.prefix;
	const domain = prefix.replace(/_/, '-').replace(/wiki$/, '.wikipedia.org')
		.replace(/wiktionary/, '.wiktionary.org')
		.replace(/wikisource/, '.wikisource.org')
		.replace(/wikivoyage/, '.wikivoyage.org');
	let year = (new Date()).getFullYear();
	let month = (new Date()).getMonth();
	if (month === 1) {
		year = year - 1;
		month = 12;
	} else {
		month = month - 1;
	}

	if (month < 10) {
		month = `0${ month }`;
	}
	// Hardcoding for now because 2025 data isn't available yet
	year = 2024;
	month = 12;
	console.log('Processing: ' + prefix + "; fetching: " + count + " items!");
	const fetchArgs = {
		prefix: prefix,
		count: count,
		uri: `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${ domain }/all-access/${ year }/${ month }/all-days`
	};
	fetchAll(fetchArgs, []);
});

