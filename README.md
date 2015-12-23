Testreduce
==========

This codebase has been extracted from [Mediawiki Parsoid](http://www.mediawiki.org/wiki/Parsoid)
repository. In the current form, this codebase still has some
hardcoded references and uses to the Parsoid usecase which involves
mass roundtrip (wikitext -> html -> wikitext) testing of wikipages
from several wikis.

This repository provides:
* a test coordination server that hands out test requests to
testing clients, accepts test results from them, and records
the results in a database (see server/)
* a web interface for examining the test results (see server/)
* a test client that fetches tests from the server, runs the
test with a configurable test script, and sends the response
back to the server (see client/).

To run:
* set up a mysql database (see server/sql/)
* import a set of titles to run (see server/importJson.js)
* start up the server (node server/server.js)
* start up test clients (via a cluster master or individual clients)

License
-------

Copyright (c) 2011-2015 Wikimedia Foundation and others; see
`AUTHORS.txt`.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
