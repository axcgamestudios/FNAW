#!/bin/bash
# probe.sh "<js>" [intentos] — eval con reintentos hasta obtener salida
JS="$1"; N="${2:-6}"; W="${3:-20}"
for i in $(seq 1 "$N"); do
  R=$(timeout 45 agent-browser eval "$JS" 2>&1 | tail -1)
  if [ -n "$R" ] && [ "$R" != "✗ CDP command timed out: Runtime.evaluate" ] && [[ "$R" != *timed\ out* ]]; then
    echo "$R"
    exit 0
  fi
  echo "  (intento $i sin respuesta, ${W}s...)" >&2
  sleep "$W"
done
echo "FALLO-SONDA"
exit 1
