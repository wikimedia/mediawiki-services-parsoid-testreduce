#!/usr/bin/env node
'use strict';
require('../../core-upgrade.js');
var fs = require('fs');
var request = require('request');
var testdb = require('./testdb.info.js');
var wikis = testdb.wikis;

var processRes, fetchAll;

processRes = function(fetchArgs, out, err, resp, body) {
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
	var resContinue = body['continue'];
	if (resContinue && fetchArgs.count > 0) {
		fetchArgs.opts['continue'] = resContinue['continue'];
		fetchArgs.opts.rccontinue = resContinue.rccontinue;
		fetchAll(fetchArgs, out);
	} else {
		var fileName = './' + fetchArgs.prefix + '.rc_titles.txt';
		console.warn('Got ' + out.length + ' titles from ' + fetchArgs.prefix + '; writing to ' + fileName);
		fs.writeFileSync(fileName, out.join('\n'));
	}
};

fetchAll = function(fetchArgs, out) {
	var n = fetchArgs.count;
	var opts = fetchArgs.opts;
	opts.rclimit = n < 500 ? n : 500;
	var requestOpts = {
		method: 'GET',
		followRedirect: true,
		uri: fetchArgs.uri,
		qs: opts,
	};
	fetchArgs.count -= opts.rclimit;

	// console.log('Fetching ' + opts.rclimit + ' results from ' + fetchArgs.prefix);
	request(requestOpts, processRes.bind(null, fetchArgs, out));
};

// SSS: +0.02 is so we fetch a few extra titles
// to account for the title overlap between the list of
// randomly generate titles and recently edited titles
var sum = wikis.reduce(function(s, w) { return s + w.limit; }, 0);
var rcSize = ((1 - testdb.dump_percentage/100) + 0.02) * testdb.size;
wikis.forEach(function(obj) {
	var prefix = obj.prefix;
	var count = Math.round(obj.limit/sum * rcSize);
	var domain = prefix.replace(/wiki$/, '.wikipedia.org').
		replace(/wiktionary/, '.wiktionary.org').
		replace(/wikisource/, '.wikisource.org').
		replace(/wikivoyage/, '.wikivoyage.org');
	var opts = {
		action: 'query',
		list: 'recentchanges',
		format: 'json',
		rcnamespace: '0',
		rcprop: 'title',
		rcshow: '!bot',
		rctoponly: true,
		'continue': '',
	};

	console.log('Processing: ' + prefix + "; fetching: " + count + " items!");
	var fetchArgs = {
		prefix: prefix,
		count: count,
		uri: 'http://' + domain + '/w/api.php',
		opts: opts,
	};
	fetchAll(fetchArgs, []);
});

