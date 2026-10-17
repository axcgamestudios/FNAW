#!/bin/bash
# Transcribe phone call candidates from FN1, one at a time with long pauses
cd /home/z/my-project/downloads_src/fn1/files
OUT=/home/z/my-project/downloads_src/fn1/call_transcripts.txt
> "$OUT"
mkdir -p wav
for f in 0028 0041 0042 0043 0044 0045 0037; do
  ffmpeg -y -v quiet -i "$f.mp3" -ar 16000 -ac 1 wav/$f.wav 2>/dev/null
  echo "=== $f ===" >> "$OUT"
  result=$(z-ai asr --file "wav/$f.wav" -o "/tmp/asr_$f.json" 2>/dev/null; cat "/tmp/asr_$f.json" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('text',''))" 2>/dev/null)
  if [ -z "$result" ]; then
    sleep 20
    result=$(z-ai asr --file "wav/$f.wav" -o "/tmp/asr_$f.json" 2>/dev/null; cat "/tmp/asr_$f.json" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('text',''))" 2>/dev/null)
  fi
  echo "${result:-NO-TEXT}" | head -c 500 >> "$OUT"
  echo "" >> "$OUT"
  sleep 15
done
cat "$OUT"
