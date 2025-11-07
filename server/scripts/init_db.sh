#!/bin/bash
set -eu -o pipefail
if [ $# -lt 1 ]; then
	echo "USAGE: $0 MYSQL_DB MYSQL_DB_PASSWORD"
	exit 1
fi
db=$1
db_password=$2

mkdir -p dbdata

echo "---- BACKUP DB ----"
date=$(date '+%Y-%m-%d')
mysqldump --databases "$db" -u testreduce -p"$db_password" > backups/$db.$date.sql

echo "---- CLEAR DB ----"
mysql -u testreduce -p"$db_password" "$db" <<@END
truncate commits;
truncate pages;
truncate results;
truncate stats;
@END

# -- if we want do this the node way --
wikis=$(echo "console.log(require('./testdb.info.js').wikis.join(' '))" | node)
echo $wikis
for w in $wikis
do
	echo "---- TITLE GENERATION FOR $w ----"
	if [ -f dbdata/$w.titles.sql ]
	then
		echo "-- Importing existing titles for $w --"
		echo "mysql -u testreduce -p"$db_password" "$db" < dbdata/$w.titles.sql"
		mysql -u testreduce -p"$db_password" "$db" < "dbdata/$w.titles.sql"
	else
		# Run the scripts
		echo "---- Fetching top_ranked pages ----"
		node fetch_top_ranked.js $w

		echo "---- Fetching recent_stream pages ----"
		node fetch_rc.js $w

		echo "---- Fetching dumps & generating sql files ----"
		node gen_titles.js $w

		if [ -f dbdata/$w.titles.sql ]
		then
			echo "-- Importing titles for $w --"
			echo "mysql -u testreduce -p"$db_password" "$db" < dbdata/$w.titles.sql"
			mysql -u testreduce -p"$db_password" "$db" < "dbdata/$w.titles.sql"
		else
			echo "FAILED to generate titles for $w"
		fi
	fi
done
echo "---- ALL DONE ----"
