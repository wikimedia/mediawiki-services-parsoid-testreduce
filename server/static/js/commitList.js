/* global $:false */
'use strict';

(function(exports) {
	let numRows, newHash, oldHash;

	const setCompareLinks = function() {
		$('.compare-reg').attr('href', '/regressions/between/' + oldHash + '/' + newHash);
		$('.compare-fix').attr('href', '/topfixes/between/' + oldHash + '/' + newHash);
	};

	const button = function(name, index) {
		return $('.revisions tr:eq(' + index + ') .buttons input[name="' + name + '"]');
	};

	const buttonDisplay = function(name, index, visibility) {
		$(button(name, index)).css('visibility', visibility);
	};

	// set initial regressions/fixes links, button visibility/checkedness
	exports.initialCommitList = function() {
		numRows = $('.revisions tr').length;
		newHash = $('.revisions tr:eq(0) .hash').attr('title');
		oldHash = $('.revisions tr:eq(1) .hash').attr('title');
		setCompareLinks();
		button('new', 0).attr('checked', 'checked');
		button('old', 1).attr('checked', 'checked');
		buttonDisplay('old', 0, 'hidden');
		for (let i = 1; i < numRows; i++) {
			buttonDisplay('new', i, 'hidden');
		}
	};

	// button click callback: update regressions/fixes links and button visibility
	exports.updateCommitList = function(name) {
		if (name === 'old') {
			oldHash = this.value;
		} else {
			newHash = this.value;
		}
		setCompareLinks();
		const index = $(this).closest('tr').index();
		for (let i = 0; i < numRows; i++) {
			if (name === 'old' && i < index) {
				buttonDisplay('new', i, 'visible');
			} else if (name === 'old') {
				buttonDisplay('new', i, 'hidden');
			} else if (name === 'new' && i > index) {
				buttonDisplay('old', i, 'visible');
			} else {
				buttonDisplay('old', i, 'hidden');
			}
		}
	};
})(this);
