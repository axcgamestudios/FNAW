#!/bin/bash
# vigilante: reinicia el generador si muere (salta lo ya generado)
cd /home/z/my-project
for i in $(seq 1 40); do
  python3 -u scripts/gen_call_voice.py >> /tmp/gen_voice.log 2>&1
  N=$(ls public/audio/calls/*.mp3 2>/dev/null | wc -l)
  M=$(python3 -c "import json; m=json.load(open('public/audio/calls/manifest.json')); print(sum(len(v) for v in m.values()))" 2>/dev/null || echo 999)
  echo "[watchdog] ronda $i terminada: $N mp3, esperados $M" >> /tmp/gen_voice.log
  if [ "$N" -ge "$M" ] && [ "$M" != "999" ] && [ "$N" -gt 0 ]; then
    echo "[watchdog] COMPLETO: $N líneas" >> /tmp/gen_voice.log
    break
  fi
  sleep 5
done
