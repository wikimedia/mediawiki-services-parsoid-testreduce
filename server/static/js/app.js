/* global initialCommitList, updateCommitList, $:false */
'use strict';

$(function() {
	initialCommitList();

	$('.revisions input').on('click', function() {
		const name = $(this).attr('name');
		updateCommitList.bind(this, name).call();
	});
});
