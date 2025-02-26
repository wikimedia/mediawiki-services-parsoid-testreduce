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
		'ukwiktionary', 'mkwiktionary', 'nnwiktionary', 'stwiktionary', 'iewiktionary',
		'gnwiktionary', 'cowiktionary', 'kbdwiktionary', 'tkwiktionary', 'pnbwiktionary',
		'pawiktionary', 'angwiktionary', 'suwiktionary', 'csbwiktionary', 'mtwiktionary',
		'ckbwiktionary', 'fowiktionary', 'ugwiktionary', 'aywiktionary', 'yiwiktionary',
		'zuwiktionary', 'mniwiktionary', 'kcgwiktionary', 'gvwiktionary', 'btmwiktionary',
		'blkwiktionary', 'wowiktionary', 'kwwiktionary', 'fjwiktionary', 'klwiktionary',
		'gomwiktionary', 'hsbwiktionary', 'tswiktionary', 'nahwiktionary', 'tpiwiktionary',
		'tnwiktionary', 'tiwiktionary', 'sswiktionary', 'smwiktionary', 'rwwiktionary',
		'chrwiktionary', 'roa_rupwiktionary', 'quwiktionary', 'pswiktionary', 'dvwiktionary',
		'nawiktionary'
	],
};
