#!/bin/bash
# watchdog v12: reinicia el generador EN si muere; salta lo ya generado
cd /home/z/my-project
for i in $(seq 1 60); do
  python3 -u scripts/gen_call_voice_en.py >> /tmp/voicegen_v12.log 2>&1
  M=$(python3 -c "import json; m=json.load(open('public/audio/calls/manifest.json')); print(sum(len(v) for v in m.values()))" 2>/dev/null || echo 999)
  N=$(ls public/audio/calls/*.mp3 2>/dev/null | wc -l)
  echo "[watchdog] ronda $i: $N mp3 / esperadas $M" >> /tmp/voicegen_v12.log
  if [ "$M" != "999" ] && [ "$N" -ge "$M" ]; then
    echo "[watchdog] COMPLETO: $N lineas" >> /tmp/voicegen_v12.log
    break
  fi
  sleep 5
done
