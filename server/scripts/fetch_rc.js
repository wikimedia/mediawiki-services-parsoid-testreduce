#!/usr/bin/env node

'use strict';
const fs = require('fs');
const request = require('request');
const testdb = require('./testdb.info.js');
const wikis = testdb.wikis;

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
		const suffix = fetchArgs.isTalk ? '_talk' : '';
		const fileName = './dbdata/' + fetchArgs.prefix + suffix + '.rc_titles.txt';
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

// +0.02 is so we fetch a few extra titles to account for the title overlap
// between the list of randomly generated titles and recently edited titles.
const sum = wikis.reduce(function(s, w) {
	return s + w.limit;
}, 0);
const fraction = ((1 - (testdb.popular_pages_percentage + testdb.dump_percentage) / 100) + 0.02);
wikis.forEach(function(obj) {
	const isTalk = obj.ns === 1;
	// For talk namespaces, we don't pick a fraction of titles from the dump.
	// So, we use a fraction of 1 for the talk namespace.
	const count = Math.ceil(obj.limit / sum * (isTalk ? 1 : fraction) * testdb.size);
	const prefix = obj.prefix;
	const domain = prefix.replace(/_/, '-').replace(/wiki$/, '.wikipedia.org')
		.replace(/wiktionary/, '.wiktionary.org')
		.replace(/wikisource/, '.wikisource.org')
		.replace(/wikivoyage/, '.wikivoyage.org');
	const opts = {
		action: 'query',
		list: 'recentchanges',
		format: 'json',
		rcnamespace: isTalk ? '1' : '0',
		rcprop: 'title',
		rcshow: '!bot',
		rctoponly: true,
		'continue': '',
	};

	console.log('Processing: ' + prefix + "; fetching: " + count + " items!");
	const fetchArgs = {
		prefix: prefix,
		isTalk: isTalk,
		count: count,
		uri: 'http://' + domain + '/w/api.php',
		opts: opts,
	};
	fetchAll(fetchArgs, []);
});

