#!/usr/bin/env node
'use strict';

var fs = require('fs');
var request = require('request');
var cp = require('child_process');
var testdb = require('./testdb.info.js');
var wikis = testdb.wikis;
var Promise = require('prfun/wrap')(require('babybird'));

var execP = Promise.promisify(cp.exec, ['stdout', 'stderr'], cp);
function generate_titles() {
	var sum = wikis.reduce(function(s, w) { return s + w.limit; }, 0);
	var dumpSize = testdb.size * testdb.dump_percentage / 100;
	Promise.reduce(wikis, function(unused, w) {
		var wiki = w.prefix;
		var n = Math.round(w.limit/sum * dumpSize);
		var total = Math.round(n * 100 / testdb.dump_percentage);
		var file = wiki + ".random_titles.txt";
		var commands = [
			"zcat " + wiki.replace(/-/g, '_') + "-latest-all-titles-in-ns0.gz | shuf | head -" + n + " > " + file,
			"head -2 " + file,
			"cat " + file + " " + wiki + ".rc_titles.txt | sort | uniq | shuf | head -" + total + " > " + wiki + ".all_titles.txt",
		];

		console.log("--- wiki " + w.prefix + "----");
		console.log("Generating " + n + " random titles from dump");
		console.log("Generating " + total + " titles in all");
		return execP(commands.join("; ")).then(function(out) {
			console.log(out.stdout);
			var titles = fs.readFileSync(wiki + ".all_titles.txt", 'utf8').split(/[\n\r]+/);
			var out = [];
			for (var i = 0; i < titles.length; i++) {
				out.push('INSERT IGNORE INTO pages(title, prefix) VALUES("' + titles[i].replace(/"/g, '\\"') + '", "' + wiki + '");');
			}
			fs.writeFileSync(wiki + ".titles.sql", out.join("\n"));
			console.log("Generated sql import script @ " + wiki + ".titles.sql");
			return true;
		}).catch(function(e) {
			console.log("Error: " + e);
		});
	}, 0);
}

generate_titles();
