#!/bin/bash
# v7_probe.sh <archivo.js> [intentos] — eval con reintentos hasta obtener salida
JS="$1"; N="${2:-8}"
for i in $(seq 1 "$N"); do
  R=$(timeout 50 agent-browser eval "$(cat "$JS")" 2>&1 | tail -1)
  if [ -n "$R" ] && [ "$R" != "✗ CDP command timed out: Runtime.evaluate" ]; then
    echo "$R"
    exit 0
  fi
  sleep 25
done
echo "FALLO-SONDA"
exit 1
