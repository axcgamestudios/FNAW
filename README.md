# FNAW — Vigilia en la Pizzería Estelar

Survival horror 3D en primera persona inspirado en el tono de *Five Nights at Freddy's*
y el juego libre de *Security Breach*: explora una pizzería abandonada de 1987, cumple
objetivos, descubre qué pasó y escapa. Construido con **Next.js 16 + React 19 + Three.js
+ Web Audio API**.

Los **modelos 3D (Freddy, Bonnie, Chica, Foxy, Jeremy y la linterna) y las texturas
provienen del repositorio del usuario** (github.com/axcgamestudios/FNAW) y se cargan
como GLB con sus esqueletos reales, animados proceduralmente (caminar, correr,
vigilar, atacar, gatear en conductos) más los clips incluidos (idle de Bonnie, ragdolls
de Foxy). El audio es 100% síntesis en tiempo real.

## Cómo jugar

Requiere navegador de escritorio moderno (Chrome, Edge, Firefox) con WebGL 2.

```bash
bun install      # o npm install
bun run dev      # http://localhost:3000
bun run build && bun run start   # producción
```

### Controles

| Tecla | Acción |
|---|---|
| `W A S D` | Moverse |
| `Ratón` | Mirar (clic para capturar; también arrastrar con clic) |
| `Shift` | Correr (resistencia + ruido) |
| `Ctrl` | Agacharse / gatear en conductos |
| `E` | Interactuar / mantener para reparar |
| `F` | Linterna (modelo GLB en mano, batería limitada) |
| `Q` | Máscara (engaña a Bonnie/Chica/Freddy; no a Foxy ni a Dorado) |
| `C` | Tableta de cámaras (12 cámaras con visión nocturna) |
| `A/D` o `1-9` | Cambiar cámara |
| `E / clic` | Saltar cinemática · `ESC` omite toda la cinemática |
| `Esc` | Pausa real (todo congelado) |

## Historia (4 capítulos con cinemáticas)

1. **Turno de Prueba** — llega a la pizzería (cinemática de llegada con Jeremy), recoge
   tu equipo, repara el panel con fusibles y comprueba las cámaras. Freddy acecha.
2. **Avería en Serie** — Bonnie (conductos) y Chica (ruidos) despiertan. Repara las
   cámaras 05/09, el panel eléctrico e investiga la cocina. Recupera la cinta del taller.
3. **La Sala Prohibida** — Foxy corre por los pasillos. Encuentra el código (1987), abre
   el almacén sur y empuja la estantería: la **cinta dorada** despierta a **Freddy
   Dorado**, que te caza sin descanso hasta volver a la oficina.
4. **Amanecer** — todos activos: fusible maestro (3-1-4-2), la llave de la sala oculta y
   el escape final. Dos finales según las cintas recogidas (11 en total).

## Los animatrónicos (modelos GLB del repositorio)

| Personaje | Modelo | Comportamiento | Contraataque |
|---|---|---|---|
| **Freddy** | freddy.glb | Patrulla y persigue directo | Máscara a tiempo |
| **Bonnie** | bonnie.glb (idle animado) | Conductos de ventilación | Linterna directa (lo congela) |
| **Chica** | chica.glb | Atraída por ruidos | Silencio / máscara |
| **Foxy** | foxy.glb | Veloz, ignora la máscara | Linterna a los ojos |
| **Freddy Dorado** | freddy.glb tintado | Caza implacable por guion | Correr y no mirar atrás |

Extras: Foxy inerte en pose ragdoll en el taller, Jeremy en la cinemática de llegada y
la linterna GLB como modelo en primera persona.

## Arquitectura

```
public/models/*.glb      Modelos del repositorio del usuario
public/textures/*.jpg    Texturas del repositorio (suelos, metal)
src/data/*.json          Capítulos, cinemáticas, enemigos, eventos, historia
src/game/
  core/                  Game (orquestador), estado, tipos
  world/                 assets.ts (carga GLB + mapeo de huesos), mundo, props
  characters/            Modelos procedurales (fallback si falla un GLB)
  player/                FPS: movimiento, colisiones, linterna en mano
  ai/                    NavGraph A* + FSM de animatrónicos + pose anti-T
  systems/               CinePlayer, cámaras, misiones, eventos, guardado
  audio/                 Web Audio: audio espacial HRTF y síntesis
src/components/game/     Menú FNAF, HUD, tableta, cinemáticas, pantallas
```

El mapa tiene **19 salas conectadas + 7 conductos**, colisiones reales, luces con
parpadeo y apagones, y texturas reales del repositorio (suelo ajedrez, moqueta de
fiesta, hormigón, madera, metal).

## Notas técnicas

- **Cámaras**: render desde posiciones reales con exposición de visión nocturna e
  interferencias cuando hay un animatrónico en la sala (CAM 08 solo audio).
- **Corrección de T-pose**: los esqueletos GLB se posan con pivotes correctores
  calculados por quaternions en espacio mundo, y la animación procedural es aditiva
  sobre la pose de reposo.
- **Rendimiento**: culling de luces, instancing, degradación automática de calidad.
- **Guardado**: localStorage con recuperación ante datos corruptos.

## GitHub Pages (despliegue automático)

Este repo ya incluye el workflow `.github/workflows/deploy-pages.yml`:

1. Crea un repositorio en GitHub y sube este proyecto (`git push` a `main`).
2. En el repo: **Settings → Pages → Source: GitHub Actions**.
3. El workflow construye el export estático y lo publica solo en cada push.
   - Si el repo se llama `usuario.github.io` → se sirve en la raíz.
   - Cualquier otro nombre → se sirve en `https://usuario.github.io/<repo>/`
     (el `basePath` se calcula automáticamente en el workflow).

Build local de Pages:

```bash
BUILD_MODE=pages npm run build:pages   # salida estática en ./out
npx serve out                          # probarlo
```
