'use strict';
require('../../core-upgrade.js');
var fs = require('fs');
var request = require('request');

var wikis = [
	{ prefix: 'enwiki', limit: 150 },
	{ prefix: 'dewiki', limit: 50 },
	{ prefix: 'nlwiki', limit: 50 },
	{ prefix: 'frwiki', limit: 50 },
	{ prefix: 'itwiki', limit: 50 },
	{ prefix: 'ruwiki', limit: 50 },
	{ prefix: 'eswiki', limit: 50 },
	{ prefix: 'ptwiki', limit: 30 },
	{ prefix: 'plwiki', limit: 30 },
	{ prefix: 'hewiki', limit: 20 },
	{ prefix: 'svwiki', limit: 10 },
	{ prefix: 'jawiki', limit: 10 },
	{ prefix: 'arwiki', limit: 10 },
	{ prefix: 'hiwiki', limit: 10 },
	{ prefix: 'kowiki', limit: 10 },
	{ prefix: 'zhwiki', limit: 10 },
	{ prefix: 'ckbwiki', limit: 2 },
	{ prefix: 'cuwiki', limit: 2 },
	{ prefix: 'cvwiki', limit: 2 },
	{ prefix: 'hywiki', limit: 2 },
	{ prefix: 'iswiki', limit: 2 },
	{ prefix: 'kaawiki', limit: 2 },
	{ prefix: 'kawiki', limit: 2 },
	{ prefix: 'lbewiki', limit: 2 },
	{ prefix: 'lnwiki', limit: 2 },
	{ prefix: 'mznwiki', limit: 2 },
	{ prefix: 'pnbwiki', limit: 2 },
	{ prefix: 'ukwiki', limit: 2 },
	{ prefix: 'uzwiki', limit: 2 },
	{ prefix: 'enwiktionary', limit: 2 },
	{ prefix: 'frwiktionary', limit: 2 },
	{ prefix: 'itwiktionary', limit: 2 },
	{ prefix: 'eswiktionary', limit: 2 },
	{ prefix: 'enwikisource', limit: 2 },
	{ prefix: 'frwikisource', limit: 2 },
	{ prefix: 'itwikisource', limit: 2 },
	{ prefix: 'eswikisource', limit: 2 },
	{ prefix: 'enwikivoyage', limit: 2 },
	{ prefix: 'frwikivoyage', limit: 2 },
	{ prefix: 'itwikivoyage', limit: 2 },
	{ prefix: 'eswikivoyage', limit: 2 },
];

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

var FRACTION = 100*1/3;
wikis.forEach(function(obj) {
	var prefix = obj.prefix;
	var count = Math.round(obj.limit * FRACTION);
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

	console.log('Processing: ' + prefix);
	var fetchArgs = {
		prefix: prefix,
		count: count,
		uri: 'http://' + domain + '/w/api.php',
		opts: opts,
	};
	fetchAll(fetchArgs, []);
});

