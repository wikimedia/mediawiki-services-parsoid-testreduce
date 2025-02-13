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
		'iowiktionary', 'etwiktionary', 'dawiktionary', 'swwiktionary', 'glwiktionary',
		'ltwiktionary', 'mywiktionary', 'eowiktionary', 'mlwiktionary', 'afwiktionary',
		'skwiktionary', 'ocwiktionary', 'tewiktionary', 'iswiktionary', 'wawiktionary',
		'kawiktionary', 'azwiktionary', 'bclwiktionary','jvwiktionary', 'tlwiktionary',
		'hrwiktionary', 'kmwiktionary', 'lawiktionary', 'mnwwiktionary', 'brwiktionary',
		'lmowiktionary', 'hawiktionary', 'astwiktionary', 'yuewiktionary', 'sqwiktionary',
		'urwiktionary', 'zh_min_nanwiktionary', 'liwiktionary', 'shnwiktionary', 'mnwiktionary',
		'sawiktionary', 'kkwiktionary', 'cywiktionary', 'minwiktionary', 'siwiktionary'
	],
};
