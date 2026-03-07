#!/bin/bash
# Generate a reproducible arbitrary amount of pseudo-random data given a seed
set -eu -o pipefail
if [ $# -lt 1 ]; then
	echo "USAGE: $0 <SEED>"
	exit 1
fi
basedir=$(dirname "$0")
# from the "Random sources" topic in `info shuf`
exec shuf --random-source=<($basedir/seeded_random.sh "$1")
