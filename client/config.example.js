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

			// This is the function that does the actual testing.
			// It will be passed the testerConfig object below.
			// It is expected to return a promise.
			//
			// TODO: Document format of expected results to satisfy the server
			runTest: function(config, test) {
				// .. run your test ..
			},

			testerConfig: {
				// Any tester-specific configuration here.
				// This object will be passed to the runTest function above.
			},
		};
	}
}());
