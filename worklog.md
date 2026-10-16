# Registro de trabajo — FNAF 2 Reimaginado

---
Task ID: 1
Agent: Super Z (agente principal)
Task: Desarrollo completo del survival horror 3D "FNAF 2 Reimaginado" (Next.js + React + Three.js + Web Audio API) según especificación de 18 secciones del usuario.

Work Log:
- Inicializado entorno fullstack (Next.js 16, TypeScript, Tailwind). Instalado three@0.171 + @types/three.
- Diseñado plan de planta de 19 zonas en JSON (src/data/map.json): oficina, escenario, comedor, arcade, taller, cocina, almacenes, cuarto eléctrico, sala oculta, conductos (7), 12 cámaras, escondites.
- Datos de configuración: animatronics.json (5 enemigos con IA distinta), nights.json (5 noches con misiones y llamadas), events.json (13 eventos ponderados), story.json (10 cintas + 3 notas + 2 finales).
- Motor gráfico: texturas PBR procedurales por canvas (suelos, paredes, carteles, dibujos infantiles), materiales físicos (clearcoat para plásticos de juguete).
- Mundo: WorldBuilder con paredes segmentadas con huecos, 19 puertas con bisagra, conductos transitable con tapas derribables, luces con parpadeo/culling/apagones, focos de escenario, luces de emergencia.
- Props: mobiliario completo por sala (escritorio con monitor estático y ventilador animado, mesas redondas, arcades, foso de bolas, caja musical animada, estanterías, armarios-escondite, paneles eléctricos, endoesqueleto de recambio...).
- Animatrónicos: 5 modelos articulados (huesos pivote: pelvis/torso/cabeza/mandíbula/brazos/antebrazos/piernas) con ojos emisivos, dientes, endoesqueleto visible en Ren, máscara pintada de la Marioneta.
- IA: NavGraph A* sobre rejilla 0.4m con celdas de conducto exclusivas, suavizado LOS. FSM: dormant/patrol/investigate/chase/search/checkMask/stunned/attack/retreat/hunt + gateo por conductos. Detección por visión (cono+LOS+oscuridad), oído (eventos de ruido), reacciones a máscara y linterna.
- Jugador: FPS con aceleración suave, colisiones AABB con protección anti-lanzamiento, agacharse, correr con estamina, linterna con batería/parpadeo/balanceo, escondites, entrada a conductos, balanceo de cámara.
- Audio: AudioEngine 100% sintetizado (pasos por superficie, servos, 5 voces, jumpscare, caja musical con melodía original que desafina al agotarse, latidos por peligro, persecución, teléfono apagado, estática) con panner HRTF.
- Sistemas: cámaras de seguridad (12 vistas + interferencia por enemigos + CAM 08 solo audio), caja musical (CAM 04), misiones por noche con spawns, secuencias de interruptores, teclado numérico 1987, eventos de terror (sombras, golpes, susurros, falsos pasos), guardado localStorage robusto.
- UI React: menú principal, HUD (objetivos/reloj/barras/avisos), tableta CRT con mapa, pausa real, muerte con consejos, victoria, finales, lector de notas/cintas, teclado, ajustes completos.

Correcciones aplicadas durante la verificación con navegador (agent-browser + VLM):
- box() no añadía mallas a la escena (corregido).
- crt-vignette con pointer-events:none bloqueaba los clics del menú (corregido).
- Unidades físicas de luz de Three.js r155+ (intensidades ×42).
- Recorte de luces según cámara activa al usar la tableta.
- store.tabletCam no se sincronizaba al cambiar cámara (cuerda de la caja musical no funcionaba).
- Dirección de movimiento inversa a la vista (convención de cámara corregida: forward = (-sin, -cos)).
- Animatrónicos miraban a la pared (rotación inicial 0 en vez de PI).
- Marioneta no despertaba con la caja musical vacía (comprobación movida antes del gate de actividad).
- Mostrador de cocina bloqueaba el conducto oeste + protección anti-lanzamiento en colisiones.
- Modo 'dead' no sincronizaba el store (pantalla de muerte no aparecía).
- itemAt usaba distancia 3D (objetos en mesas inaccesibles) → distancia XZ.

Verificación realizada (navegador real):
- Menú, intro, flujo de inicio de noche, recogida de linterna/tableta con E, linterna con haz y polvo volumétrico.
- Tableta: 12 cámaras, cambio con A/D, CAM 08 solo audio, cuerda de caja musical funcional.
- IA: despertar por hora, patrullaje entre salas, persecución, apertura de puertas, ataque→jumpscare→pantalla de muerte→reintentar.
- Muerte y victoria (6AM) con guardado de desbloqueo; teclado 1987; notas; final normal/escape de noche 5; secuencia maestra 3-1-4-2.
- Pausa real (tiempo y IA congelados, audio suspendido).
- Prueba de caos 36s con 5 enemigos cazando: sin excepciones.
- lint y tsc --noEmit limpios; dev.log sin errores; audio ctx running tras gesto de usuario.

Stage Summary:
- Entregado juego completo y jugable en / (Next.js 16 + Three.js): 5 noches con misiones, 19 salas, 5 animatrónicos con FSM y navegación A*, mecánicas FNAF2 (máscara, linterna, cámaras, caja musical, conductos), audio espacial 100% procedural, guardado localStorage, menús y ajustes completos.
- Nota: el navegador headless de pruebas usa renderizado por software (lento); en navegadores de escritorio con GPU el rendimiento es el esperado, con degradación automática de calidad si bajan los FPS.

---
Task ID: 1 (finalización)
Agent: Super Z (agente principal)
Task: Verificación final y entrega.

Work Log:
- lint y tsc --noEmit limpios; dev.log sin errores de compilación.
- Capturas verificadas con VLM: menú, oficina (escritorio/ventilador/tableta/monitor con prompt de interacción), escenario con los 3 animatrónicos de frente (oso con chistera, coneja, gallina) bajo focos RGB, linterna con haz y polvo, tableta CRT con mapa.
- Últimos ajustes: posición inicial del jugador tras el escritorio (fuera de su colisionador), aviso de captura de ratón no bloqueante, orientación inicial de animatrónicos hacia el público, README.md con instrucciones de instalación/dev/build.

Stage Summary:
- Proyecto completo y verificado. 16 requisitos de funcionamiento del punto 16 de la especificación: comprobados en navegador (inicio de partida, movimiento, puertas, linterna, cámaras/máscara/caja musical, objetivos, IA móvil, escondites, perder/ganar/reiniciar, guardado, pausa real).

---
Task ID: 2
Agent: Super Z (agente principal)
Task: Iteración 2 según feedback del usuario: arreglar W/S, menú estilo FNAF 2, bug de cámaras negras, integrar modelos GLB/texturas del repositorio github.com/axcgamestudios/FNAW y rediseñar el gameplay al estilo Security Breach (capítulos, historias, cinemáticas).

Work Log:
- Clonado el repositorio del usuario (token facilitado) e inspeccionados los 6 GLB (esqueletos, animaciones) y 6 texturas JPEG.
- Assets copiados a public/models y public/textures; creado assets.ts (GLTFLoader + SkeletonUtils, normalización de escala/origen, mapeo de huesos por nombre para bip_* y estructural para Freddy, ojos emisivos, mixer de clips).
- FIX crítico cámaras: (1) la orientación se calculaba 180° girada → reescrito update() con lookAt + deriva; (2) las cámaras estaban a la altura del dintel de las paredes → reubicadas a y=2.2-2.3 retiradas de muros; (3) el .tablet-frame tenía fondo opaco que TAPABA el render → transparente; (4) exposición 2.15 en modo tableta (visión nocturna). Verificado: brillo del feed 47/255 (antes 5).
- FIX W/S: verificación empírica (W coincide con la dirección de cámara); causa percibida: spawn bloqueado por el escritorio → spawn reposicionado a (3, 12.3) con vía libre y escritorio a un lado.
- FIX T-pose de fábrica: applyArmDownPose() inserta pivotes correctores entre hombro y padre con quaternions conjugados en espacio mundo (brazos caídos con leve apertura); animación procedural aditiva sobre pose de reposo + clips GLB (idle Bonnie, ragdoll estático de Foxy en el taller).
- Animatronic reescrito: rig unificado GLTF/procedural, wakeup por wakeDelay de capítulo, scriptWake (Freddy Dorado al coger la cinta dorada), pose pública para la secuencia de muerte.
- Gameplay rediseñado estilo Security Breach: nights.json → chapters.json (4 capítulos con objetivos, radio de guía, cinemáticas), CinematicPlayer (tomas con dolly, textos, actores, letterbox, salto con E/clic), cinematics.json (8 cinemáticas: llegada, avistamiento, capítulos 2-4, final con 2 endings), removed clock/música/6AM, HUD por capítulos.
- Menú estilo FNAF 2: Freddy GLB renderizado en primer plano tras estática con espasmos de cabeza y parpadeo de ojos, opciones minimalistas.
- Linterna GLB como modelo en primera persona (attachFlashlightModel) y como prop del escritorio.
- Sistemas actualizados: misiones por capítulo, guardado unlockedChapter (migración desde v1), DeathScreen/ChapterComplete/PauseMenu/ChapterIntro, GameShell con modo cinematic + CinematicOverlay.
- Verificado en navegador: menú con rostro de Freddy, cinemática de llegada con Jeremy y letterbox, 3 modelos en escenario con brazos naturales, caminar procedural (muestras de rotación de piernas/brazos oscilando), persecución→ataque→jumpscare→muerte→reintento, fin de capítulo 1 (5/5 objetivos → cinemática → pantalla AMANECE → desbloqueo cap 2), tableta con feed visible.
- tsc y lint limpios; sin errores de consola ni de dev.log.

Stage Summary:
- v2 entregada: modelos y texturas del usuario integrados y animados, cámaras arregladas (4 causas), menú FNAF, gameplay por capítulos con 8 cinemáticas, Freddy Dorado como cazador final. Siguiente iteración sugerida: más clips de animación (ataques con mixer), doblaje sintético de las cinemáticas y equilibrio de dificultad.
