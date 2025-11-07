#!/usr/bin/env node

'use strict';
const fs = require('fs');
const request = require('request');
const testdb = require('./testdb.info.js');
const wikisizes = require('./wikisizes.json');

function processRes(fetchArgs, out, err, resp, body) {
	if (err || resp.statusCode !== 200) {
		if (err) {
			console.error('Error: ' + err);
		}
		if (resp) {
			console.error('Status code: ' + resp.statusCode);
		}
		return;
	}

	// Accum titles
	body = JSON.parse(body);
	Array.prototype.reduce.call(body.query.recentchanges,
		function(titles, e) {
			titles.push(e.title);
			return titles;
		},
		out);

	// More to fetch?
	const resContinue = body.continue;
	if (resContinue && fetchArgs.count > 0) {
		fetchArgs.opts.continue = resContinue.continue;
		fetchArgs.opts.rccontinue = resContinue.rccontinue;
		fetchAll(fetchArgs, out);
	} else {
		const fileName = './dbdata/' + fetchArgs.prefix + '.rc_titles.txt';
		console.warn('Got ' + out.length + ' titles from ' + fetchArgs.prefix + '; writing to ' + fileName);
		fs.writeFileSync(fileName, out.join('\n'));
	}
}

function fetchAll(fetchArgs, out) {
	const n = fetchArgs.count;
	const opts = fetchArgs.opts;
	opts.rclimit = n < 500 ? n : 500;
	const requestOpts = {
		method: 'GET',
		followRedirect: true,
		uri: fetchArgs.uri,
		qs: opts,
	};
	fetchArgs.count -= opts.rclimit;

	console.log('Fetching ' + opts.rclimit + ' results from ' + fetchArgs.prefix);
	request(requestOpts, processRes.bind(null, fetchArgs, out));
}

function runForWiki(prefix) {
	// +0.02 is so we fetch a few extra titles to account for the title overlap
	// between the list of randomly generated titles and recently edited titles.
	const fraction = ((1 - (testdb.popular_pages_percentage + testdb.dump_percentage) / 100) + 0.02);
	const count = Math.ceil(fraction * wikisizes[prefix] * testdb.sample_size);
	const domain = prefix.replace(/_/, '-').replace(/wiki$/, '.wikipedia.org')
		.replace(/wiktionary/, '.wiktionary.org')
		.replace(/wikisource/, '.wikisource.org')
		.replace(/wikivoyage/, '.wikivoyage.org')
		.replace(/wikimedia/, '.wikimedia.org');
	const opts = {
		action: 'query',
		list: 'recentchanges',
		format: 'json',
		rcprop: 'title',
		rcshow: '!bot',
		rctoponly: true,
		'continue': '',
	};

	console.log('Processing: ' + prefix + "; fetching: " + count + " items!");
	const fetchArgs = {
		prefix: prefix,
		count: count,
		uri: 'http://' + domain + '/w/api.php',
		opts: opts,
	};
	fetchAll(fetchArgs, []);
}

const wikis = process.argv.length > 2 ? [ process.argv[2] ] : testdb.wikis;
wikis.forEach(function(prefix) {
	runForWiki(prefix);
});
