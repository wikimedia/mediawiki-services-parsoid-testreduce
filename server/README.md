Running the round-trip test server
----------------------------------

In `tests/server/`, to install the necessary packages, run

	$ npm install

You'll need a pre-created MySQL database. Then, copy
`server.settings.js.example` to `server.settings.js` and in that file
edit the connection parameters. You can also override the settings
with command line options, to see them and their default values run:

	$ node server --help

To populate the database with initial data, you might first want to
create a user and a database.  For this example we'll use `$USER`,
`$PASSWORD`, and `$DBNAME` to stand for the user, password, and database
you specified in `server.settings.js`:

	$ mysql -u root -p$ROOTPASSWORD mysql
	mysql> CREATE USER '$USER'@'localhost' IDENTIFIED BY '$PASSWORD';
	mysql> CREATE DATABASE $DBNAME;
	mysql> GRANT ALL PRIVILEGES ON $DBNAME.* TO '$USER'@'localhost';
	mysql> \q

Now you'll want to create the initial database:

	$ mysql -u$USER -p$PASSWORD $DBNAME < sql/create_everything.mysql
	$ node importJson --prefix=enwiki titles.example.en.json
	$ node importJson --prefix=eswiki titles.example.es.json

The script importJson.js takes the same connection parameters as server.js. To
test the handling of non-existent articles, you might want to also do:

	$ node importJson --prefix=enwiki titles.example.bogus.json
	$ node importJson --prefix=eswiki titles.example.bogus.json

Now start the server:

	$ node server
