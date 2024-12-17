#!/usr/bin/env node
'use strict';

module.exports = {
	// How many titles do you want?
	size: 50000,

	// How many of those do you want from traffic popularity
	popular_pages_percentage: 5,

	// How many of those do you want from the dumps?
	// Rest will come from recent changes stream
	dump_percentage: 85,

	wikis: [
		// 1M+ wikipedias (ordered by depth)
		{ prefix: 'enwiktionary',  limit: 60 },
		{ prefix: 'frwiktionary',  limit: 20 },
		{ prefix: 'eswiktionary',  limit: 20 },
		{ prefix: 'ruwiktionary',  limit: 20 },
		{ prefix: 'itwiktionary',  limit: 15 },
		{ prefix: 'dewiktionary',  limit: 15 },
		{ prefix: 'jawiktionary',  limit: 10 },
		{ prefix: 'viwiktionary',  limit: 10 },
		{ prefix: 'plwiktionary',  limit: 10 },
		{ prefix: 'nlwiktionary',  limit: 10 },
		{ prefix: 'svwiktionary',  limit: 18 },
	],
};
