#!/bin/bash
# Generate a reproducible arbitrary amount of pseudo-random data given a seed
set -eu -o pipefail
if [ $# -lt 1 ]; then
	echo "USAGE: $0 <SEED>"
	exit 1
fi
# from the "Random sources" topic in `info shuf`
seed="$1"
openssl enc -aes-256-ctr -pass pass:"$seed" -nosalt \
	</dev/zero 2>/dev/null
