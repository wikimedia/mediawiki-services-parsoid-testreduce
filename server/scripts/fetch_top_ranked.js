#!/usr/bin/env node

'use strict';
const fs = require('fs');
const request = require('request');
const testdb = require('./testdb.info.js');
const wikisizes = require('./wikisizes.json');

function processRes(fetchArgs, out, err, resp, body) {
	if (err || resp.statusCode !== 200) {
		console.error("URI: " + fetchArgs.uri);
		if (err) {
			console.error('Error: ' + err);
		}
		if (resp) {
			console.error('Status code: ' + resp.statusCode);
			console.error(resp.body);
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
	const requestOpts = {
		method: 'GET',
		uri: fetchArgs.uri,
		headers: {
			'User-Agent': 'Parsoid-PHP/1.0 (https://mediawiki.org/wiki/Parsoid) VisualDiff/1.0',
		},
	};
	console.log('Fetching ' + n + ' results from ' + fetchArgs.prefix);
	request(requestOpts, processRes.bind(null, fetchArgs, out));
}

function runForWiki(prefix) {
	// +0.01 is so we fetch a few extra titles to account for the title overlap
	// between the different lists
	const [baseprefix, variant] = prefix.split('.', 2); // allow for a variant
	const fraction = testdb.popular_pages_percentage / 100 + 0.01;
	const count = Math.ceil(fraction * wikisizes[baseprefix] * testdb.sample_size);
	const domain = baseprefix.replace(/_/, '-')
		.replace(/wiki$/, '.wikipedia.org')
		.replace(/wiktionary/, '.wiktionary.org')
		.replace(/wikisource/, '.wikisource.org')
		.replace(/wikibooks/, '.wikibooks.org')
		.replace(/wikiquote/, '.wikiquote.org')
		.replace(/wikivoyage/, '.wikivoyage.org')
		.replace(/wikimedia/, '.wikimedia.org');
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
	// Hardcoding for now (was 2024-12)
	year = 2026;
	month = '01';
	console.log('Processing: ' + prefix + "; fetching: " + count + " items!");
	const fetchArgs = {
		prefix: prefix,
		count: count,
		uri: `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${ domain }/all-access/${ year }/${ month }/all-days`
	};
	fetchAll(fetchArgs, []);
}

const wikis = process.argv.length > 2 ? [ process.argv[2] ] : testdb.wikis;
wikis.forEach(function(prefix) {
	runForWiki(prefix);
});
