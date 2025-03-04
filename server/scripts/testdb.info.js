#!/usr/bin/env node
'use strict';

module.exports = {
	// 0.2% of all wiki titles
	sample_size: 0.002,

	// but, at least 1000 titles per wiki
	min_titles: 1000,

	// How many of those do you want from traffic popularity
	popular_pages_percentage: 5,

	// How many of those do you want from the dumps?
	// Rest will come from recent changes stream
	dump_percentage: 85,

	wikis: [
		"kaawiktionary", "madwiktionary", "glwiktionary", "mywiktionary", "wawiktionary",
		"amwiktionary", "sdwiktionary", "enwiktionary", "huwiktionary", "gdwiktionary",
		"iawiktionary", "kawiktionary", "lawiktionary", "lmowiktionary", "astwiktionary",
		"ndswiktionary"
	],
};
