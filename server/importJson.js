#!/usr/bin/env node
'use strict';

/**
 * A utility for reading in a JSON-y list of articles to the database.
 */

const yargs = require('yargs');

// Default options
const defaults = {
	'host':     'localhost',
	'port':     3306,
	'database': 'testreduce',
	'user':     'testreduce',
	'password': 'testreduce',
};

// Settings file
let settings;
try {
	// eslint-disable-next-line n/no-missing-require
	settings = require('./server.settings.js');
} catch (e) {
	settings = {};
}

// Command line options
const opts = yargs.usage('Usage: ./importJson.js titles.example.json')
	.options('help', {
		description: 'Show this message',
		'boolean': true,
		'default': false,
	})
	.options('prefix', {
		description: 'Which wiki prefix to use; e.g. "enwiki" for English wikipedia, "eswiki" for Spanish, "mediawikiwiki" for mediawiki.org',
		'boolean': false,
		'default': 'enwiki',
	})
	.options('h', {
		alias: 'host',
		describe: 'Hostname of the database server.',
	})
	.options('P', {
		alias: 'port',
		describe: 'Port number to use for connection.',
	})
	.options('D', {
		alias: 'database',
		describe: 'Database to use.',
	})
	.options('u', {
		alias: 'user',
		describe: 'User for login.',
	})
	.options('p', {
		alias: 'password',
		describe: 'Password.',
	})
	.demand(1);
const argv = opts.argv;

if (argv.help) {
	opts.showHelp();
	process.exit(0);
}

const getOption = function(opt) {
	// Check possible options in this order: command line, settings file, defaults.
	if (argv.hasOwnProperty(opt)) {
		return argv[ opt ];
	} else if (settings.hasOwnProperty(opt)) {
		return settings[ opt ];
	} else if (defaults.hasOwnProperty(opt)) {
		return defaults[ opt ];
	} else {
		return undefined;
	}
};

const mysql = require('mysql2');
const db = mysql.createConnection({
	host:               getOption('host'),
	port:               getOption('port'),
	database:           getOption('database'),
	user:               getOption('user'),
	password:           getOption('password'),
	charset:            'UTF8_BIN',
	multipleStatements: true,
});

let waitingCount = 0.5;

const dbInsert = 'INSERT IGNORE INTO pages ( title, prefix ) VALUES ( ?, ? )';

const insertRecord = function(record, prefix) {
	waitingCount++;
	db.query(dbInsert, [ record, prefix ], function(err) {
		if (err) {
			console.error(err);
		} else {
			waitingCount--;

			if (waitingCount <= 0) {
				console.log('Done!');
			}
		}
	});
};

const loadJSON = function(json, options) {
	const titles = require(json);

	db.query('START TRANSACTION;');

	for (let i = 0; i < titles.length; i++) {
		insertRecord(titles[i], options.prefix || 'enwiki');
	}

	db.query('COMMIT;');

	waitingCount -= 0.5;
	if (waitingCount <= 0) {
		console.log('Done!');
	}
};

db.connect(function(err) {
	let filepath;
	if (err) {
		console.error(err);
	} else {
		filepath = argv._[0];
		if (!filepath.match(/^\//)) {
			filepath = './' + filepath;
		}
		loadJSON(filepath, argv);
		db.end();
	}
});
