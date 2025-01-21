Running the round-trip test clients
-----------------------------------

In `client/`, copy `config.example.js` to `config.js` and edit it to your
taste.

Note in particular that
- if you provide `gitRepoPath`, you need to comment out/remove `gitCommitFetch`
if you want it taken into account
- if you're just interested in hacking around the interface and only need
mock data, you can leave `runTest` as it is and set `testTimeout: 1` in
`opts`. It will generate error results, but this might be enough for your
purposes.

In separate windows, as many as you want:

	$ node client

Then take a look at [the statistics](http://localhost:8001/).
