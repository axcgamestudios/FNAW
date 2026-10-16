# FNAF 2 REIMAGINADO — Survival Horror 3D

Un videojuego de terror y supervivencia en primera persona inspirado en las mecánicas de
*Five Nights at Freddy's 2*, pero con libertad de movimiento total: explora una pizzería
abandonada en 3D, repara sus sistemas, cumple objetivos y sobrevive a cinco noches de
animatrónicos con IA propia.

Construido con **Next.js 16 + React 19 + Three.js + Web Audio API**. Todos los gráficos
(texturas PBR) y todo el audio (síntesis en tiempo real) son 100% procedurales: **cero
dependencias de assets externos**, sin riesgo de CORS ni descargas.

## Cómo jugar

Requiere un navegador de escritorio moderno (Chrome, Edge o Firefox) con WebGL 2.

```bash
# 1. instalar dependencias
bun install        # o npm install

# 2. servidor de desarrollo
bun run dev        # http://localhost:3000

# 3. build de producción
bun run build
bun run start
```

Abre `http://localhost:3000`, haz clic en **NUEVA PARTIDA** y captura el ratón.

### Controles

| Tecla | Acción |
|---|---|
| `W A S D` | Moverse |
| `Ratón` | Mirar (clic en la pantalla para capturar; también arrastrar con clic) |
| `Shift` | Correr (gasta resistencia y hace ruido) |
| `Ctrl` | Agacharse / gatear en conductos |
| `E` | Interactuar (mantener para reparar) |
| `F` | Linterna (batería limitada) |
| `Q` | Máscara de animatrónico (engaña a algunos enemigos) |
| `C` | Tableta de cámaras |
| `A / D` o `1-9` | Cambiar cámara (con la tableta abierta) |
| `Espacio` / botón | Dar cuerda a la caja musical (CAM 04) |
| `Esc` | Pausa |

## Las cinco noches

1. **La Primera Ronda** — tutorial integrado: recoge la linterna y la tableta, encuentra
   fusibles, repara el panel de la oficina y comprueba la caja musical.
2. **Señales Perdidas** — repara las cámaras averiadas (05 y 09), repone el panel eléctrico
   e investiga el ruido de la cocina. La coneja empieza a usar los conductos.
3. **Rastros** — recupera 3 cintas de mantenimiento, reinicia la estación del taller y
   abre el almacén sur con el código de la nota. El zorro Ren despierta: no se deja
   engañar por la máscara.
4. **Sistemas Críticos** — restaura el sector oeste con la secuencia correcta de
   interruptores, tapa los conductos y no dejes que la energía caiga del 15%.
5. **La Última Noche** — fusible maestro (3-1-4-2), la llave escondida tras la estantería
   de la sala oculta y el escape final por el vestíbulo. Dos finales según las cintas
   recogidas (10 en total).

## Los animatrónicos

| Personaje | Comportamiento | Contraataques |
|---|---|---|
| **Bruno el Oso** | Patrulla pasillos y comedor; persecución directa | Máscara a tiempo, correr |
| **Clara la Coneja** | Usa los conductos de ventilación | Linterna directa (la congela), tapas de conducto |
| **Gina la Gallina** | Acude a los ruidos, acecha la cocina | Silencio (agacharse), máscara parcial |
| **Ren el Zorro** | Corredor veloz de pasillos; ignora la máscara | Linterna a los ojos (lo ahuyenta), esquivar |
| **La Marioneta** | Caza implacable cuando la caja musical se para | Dar cuerda a la caja (CAM 04) |

## Arquitectura

```
src/
  app/                  Entrada Next.js (page, layout, CSS del juego)
  components/game/      UI React: menú, HUD, tableta, pausa, muerte, notas...
  game/
    core/               Game (orquestador), tipos, estado zustand
    world/              Mundo: texturas PBR procedurales, plan de planta,
                        puertas con bisagra, conductos, mobiliario
    characters/         Modelos articulados de los 5 animatrónicos
    player/             Jugador FPS: movimiento, colisiones, linterna
    ai/                 Grafo de navegación A* + máquina de estados de la IA
    systems/            Cámaras, misiones, eventos de terror, guardado
    audio/              Motor Web Audio: audio espacial HRTF y síntesis
src/data/*.json         Configuración: mapa, noches, enemigos, eventos, historia
```

El edificio tiene **19 zonas conectadas** (oficina, escenario, comedor, arcade, taller,
cocina, cuarto eléctrico, sala oculta, conductos...) con colisiones reales, luces que
parpadean y fallan, y rutas alternativas.

## Rendimiento

- Calidad automática: si los FPS caen, se reduce resolución/sombras en tiempo real.
- Ajustes manuales en **AJUSTES** (volumen, sensibilidad, invertir Y, calidad).
- Culling de luces (solo las 11 más cercanas al jugador o cámara activa).

## Guardado

El progreso (noches desbloqueadas, cintas, finales, ajustes) se guarda en
`localStorage` con recuperación ante datos corruptos.
