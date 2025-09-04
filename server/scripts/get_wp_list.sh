#!/bin/bash

start=$1
count=$2
end=`expr $start + $count`

jq --argjson start $start --argjson end $end '.[$start:$end] | map(select(.lvs == null)) | map(.prefix)' wps.json
