#!/bin/bash
# Transcribe the FN1 long audio files one by one with delays (rate limit)
cd /home/z/my-project/downloads_src/fn1/files
OUT=/home/z/my-project/downloads_src/fn1/transcripts.txt
> "$OUT"
for f in 0041 0000 0037 0042 0043 0044 0035 0030 0028 0045; do
  echo "=== $f ===" >> "$OUT"
  result=$(z-ai asr --file "wav/$f.wav" 2>/dev/null | grep -oP '"text"\s*:\s*"[^"]*"' | head -1)
  if [ -z "$result" ]; then
    sleep 12
    result=$(z-ai asr --file "wav/$f.wav" 2>/dev/null | grep -oP '"text"\s*:\s*"[^"]*"' | head -1)
  fi
  echo "${result:-NO-TEXT}" >> "$OUT"
  sleep 10
done
cat "$OUT"
