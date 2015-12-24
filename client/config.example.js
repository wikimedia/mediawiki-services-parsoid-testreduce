/**
 * Example configuration for the testreduce client.js script
 * Copy this file to config.js and change the values as needed.
 */

'use strict';

(function() {
	if (typeof module === 'object') {
		module.exports = {
			server: {
				// The address of the master HTTP server (for getting titles and posting results) (no protocol)
				host: 'localhost',

				// The port where the server is running
				port: 8002,
			},

			// A unique name for this client (optional) (URL-safe characters only)
			clientName: 'Parsoid RT testing client',

			opts: {
				// Custom configuration options goes here.
				// This object will be passed to runTest and gitCommitFetch functions
			},

			// This is the function that does the actual testing.
			// It will be passed the testerConfig object below.
			// It is expected to return a promise.
			//
			// TODO: Document format of expected results to satisfy the server
			runTest: function(opts, test) {
				// .. run your test ..
			},

			// The fully resolved path of the git repository against which
			// we are running mass tests.
			gitRepoPath: null,

			// This function is responsible for fetching the git commit of the
			// repo against which we are running mass tests. This function
			// is not required if you provide the gitRepoPath above. But, if
			// both are provided, gitRepoPath will be ignored
			gitCommitFetch: function(opts, cb) {
				// .. run your magic incantations and call cb(commitHash, commitTime) ..
			},
		};
	}
}());
