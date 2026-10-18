#!/usr/bin/env python3
"""Traduce cinematics.json, trials.json, map.json (nombres de salas y cámaras)
al inglés mediante mapeos exactos de texto. Conserva toda la estructura."""
import json

ROOT = "/home/z/my-project"

# ============ CINEMATICS ============
CINE_MAP = {
    "Complejo Bruno MEGAPLEX. 11:47 PM.": "Bruno MEGAPLEX. 11:47 PM.",
    "El mayor centro de ocio del estado. 6000 metros cuadrados.": "The largest entertainment complex in the state. Six thousand square meters.",
    "De día, cuatro plantas de risas. De noche, un solo guardia.": "By day, four floors of laughter. By night, one single guard.",
    "Ellos se apagan al terminar el turno... se supone.": "They power down at the end of every shift... supposedly.",
    "Tu oficina. Tu escritorio. Tu única luz.": "Your office. Your desk. Your only light.",
    "Con la energía de vuelta, el Atrio respira.": "With the power back, the Atrium breathes.",
    "Freddy permanece en el escenario. Moviéndose. Mírandote.": "Freddy stays on the stage. Moving. Watching you.",
    "Algo le ha gustado de tu turno de esta noche.": "Something about your shift tonight... pleased him.",
    "La Bolera. Cuatro carriles. Tres máquinas muertas.": "The Bowling Alley. Four lanes. Three dead machines.",
    "Bonnie ya ha aprendido el camino desde el recreativo.": "Bonnie has already learned the way from the arcade.",
    "CAM 09 — las máquinas cantan de nuevo.": "CAM 09 — the machines are singing again.",
    "La cámara enfoca. La coneja se gira. Siempre supo dónde estaba la cámara.": "The camera focuses. The rabbit turns around. She always knew where the camera was.",
    "La Plaza de Comida. Tres puestos. Tres interruptores.": "The Food Court. Three stands. Three switches.",
    "Chica ronda las mesas. Huele el horno... y te huele a ti.": "Chica circles the tables. She can smell the oven... and she can smell you.",
    "Sala Técnica Sur. El traje dorado de Spring Bruno.": "South Technical Room. The golden Spring Bruno suit.",
    "Vacío por dentro. Todavía lo está.": "Empty inside. It still is.",
    "¿Verdad?": "Right?",
    "La Cala del Pirata. Fuera de servicio desde hace años.": "Pirate's Cove. Out of service for years.",
    "Detrás del telón: el zorro roto. El rápido.": "Behind the curtain: the broken fox. The fast one.",
    "La atracción ruge de nuevo en la Cala.": "The attraction roars again in the Cove.",
    "Pero el fusible maestro sigue fundido. Y algo lo está comiendo.": "But the master fuse is still blown. And something is feeding on it.",
    "En la Sala Técnica, el traje dorado ha cambiado de pared.": "In the Technical Room, the golden suit has changed walls.",
    "La red vive. La salida espera. Solo faltan tres llaves.": "The grid is alive. The exit waits. Only three keys left.",
    "Y ellos lo saben. El complejo entero caza esta noche.": "And they know it. The whole complex is hunting tonight.",
    "Los tornos giran. El aire de la noche entra.": "The lathes spin. The night air comes in.",
    "No mires atrás. Tú nunca miras atrás.": "Don't look back. You never look back.",
    "El Complejo Bruno queda a oscuras. Como si nunca hubiera estado despierto.": "The Bruno Complex goes dark. As if it had never been awake.",
    "11:58 PM. La alberca de pelotas. Tu primera buena idea de la noche.": "11:58 PM. The ball pit. Your first good idea of the night.",
    "La SUPER GUARDERÍA duerme a oscuras. Las rejas de seguridad han bajado solas.": "The SUPER DAYCARE sleeps in the dark. The security gates came down on their own.",
    "LUNA vela la sala. Apenas ve. Pero oye cada pelota que rueda.": "MOON watches over the room. It can barely see. But it hears every ball that rolls.",
    "Quédate quieto. Respira. Y cuando pase de largo... sal AGACHADO [Ctrl].": "Stay still. Breathe. And when it passes by... crawl out CROUCHED [Ctrl].",
    "El último fuego muere con un siseo. La Mega Guardería respira.": "The last fire dies with a hiss. The Mega Daycare breathes.",
    "LUNA se retira... y SOL despierta entre el vapor. Sonríe. Casi es peor.": "MOON retreats... and SUN wakes up in the steam. It smiles. It's almost worse.",
    "Las puertas cortafuego se abren de golpe. El MEGAPLEX sigue esperando.": "The fire doors burst open. The MEGAPLEX is still waiting.",
    "Las rejas se abren con un gemido. El paseo norte te traga.": "The gates groan open. The north promenade swallows you.",
    "El MEGAPLEX entero espera a oscuras. Y algo, ahí fuera, ya sabe tu nombre.": "The whole MEGAPLEX waits in the dark. And something out there already knows your name.",
    "La MEGA GUARDERÍA. Dos mil quinientos metros cuadrados de infierno.": "The MEGA DAYCARE. Two and a half thousand square meters of hell.",
    "Entre el humo, LUNA te espera. Quieta. Sonriendo. Cantando.": "Through the smoke, MOON waits for you. Still. Smiling. Singing.",
    "Sobre el centro del techo cuelga su percha. Por si quiere volver a subir.": "Its perch hangs from the center of the ceiling. In case it wants to climb back up.",
    "Siete incendios. Siete extintores. Ninguna salida hasta el último.": "Seven fires. Seven extinguishers. No way out until the last one.",
    "El escritorio. La estática del monitor. El ventilador girando para nadie.": "The desk. The monitor static. The fan spinning for nobody.",
    "6:00 AM. Las puertas del vestíbulo se abren solas, como cada mañana.": "6:00 AM. The lobby doors open by themselves, like every morning.",
    "Amanece sobre el MEGAPLEX. El primer turno: sobrevivido.": "Dawn breaks over the MEGAPLEX. First shift: survived.",
}

ci = json.load(open(f"{ROOT}/src/data/cinematics.json"))
miss = []
for key, c in ci.items():
    for shot in c.get("shots", []):
        t = shot.get("text")
        if t in CINE_MAP:
            shot["text"] = CINE_MAP[t]
        elif t:
            miss.append(t)
json.dump(ci, open(f"{ROOT}/src/data/cinematics.json", "w"), ensure_ascii=False, indent=1)
print(f"cinematics.json: {len(miss)} textos sin traducir", miss[:5])

# ============ TRIALS ============
TRIAL_MAP = {
    # sunmoon
    "EL SÓTANO EN LLAMAS — SOL Y LUNA": "THE BURNING BASEMENT — SUN AND MOON",
    "EL HUMO SE TRAGA LA MEGA GUARDERÍA — LUNA CAE DEL TECHO. Encuentra los 7 EXTINTORES y mata los incendios. Agáchate: te OYE. Y el fuego TAMBIÉN muerde.": "SMOKE SWALLOWS THE MEGA DAYCARE — MOON DROPS FROM THE CEILING. Find the 7 EXTINGUISHERS and kill the fires. Stay crouched: it HEARS you. And the fire bites TOO.",
    "Extintor — base del castillo de juegos (O)": "Extinguisher — base of the play castle (W)",
    "Extintor — rincón noroeste": "Extinguisher — northwest corner",
    "Extintor — junto a la alberca gigante (O)": "Extinguisher — by the giant ball pit (W)",
    "Extintor — piano gigante (N)": "Extinguisher — giant piano (N)",
    "Extintor — bajo el arcoíris (E)": "Extinguisher — under the rainbow (E)",
    "Extintor — carrusel roto (E)": "Extinguisher — broken carousel (E)",
    "Extintor — rincón noreste": "Extinguisher — northeast corner",
    "LUNA SE SUELTA DEL TECHO Y CAE A POCOS METROS — EL JUEGO EMPIEZA": "MOON LETS GO OF THE CEILING AND DROPS FEW METERS AWAY — THE GAME BEGINS",
    "UNA NANA SUENA ENTRE LAS LLAMAS... CADA VEZ MÁS CERCA": "A LULLABY PLAYS AMONG THE FLAMES... CLOSER AND CLOSER",
    "PASOS SUAVES... RODEÁNDOTE... ENTRE EL HUMO": "SOFT FOOTSTEPS... CIRCLING YOU... THROUGH THE SMOKE",
    "LUNA CUERDA EL CARRUSEL — GIRO LENTO — SONRÍE DESDE ARRIBA": "MOON WINDS UP THE CAROUSEL — SLOW SPIN — SMILING FROM ABOVE",
    "LUNA CHILLA — SABE DÓNDE ESTÁS — EL HUMO TE DELATA": "MOON SHRIEKS — IT KNOWS WHERE YOU ARE — THE SMOKE GIVES YOU AWAY",
    "EL RUIDO DEL FUEGO SE CALLA UN SEGUNDO — SOLO QUEDA TU LINTERNA": "THE FIRE'S ROAR GOES SILENT FOR A SECOND — ONLY YOUR FLASHLIGHT REMAINS",
    "¡ÚLTIMO EXTINTOR — LUNA YA NO SE ESCONDE — CORRE!": "LAST EXTINGUISHER — MOON ISN'T HIDING ANYMORE — RUN!",
    "EL ÚLTIMO FUEGO MUERE. La sala respira... LUNA se retira y SOL despierta entre el vapor. Las puertas cortafuego se abren de golpe.": "THE LAST FIRE DIES. The room breathes... MOON retreats and SUN wakes up in the steam. The fire doors burst open.",
    # bowling
    "PRUEBA DE LA BOLERA": "BOWLING ALLEY TRIAL",
    "PRUEBA INICIADA — Reinicia las 3 máquinas de chapa. Bonnie ya sabe que estás aquí.": "TRIAL STARTED — Restart the 3 pinsetters. Bonnie already knows you're here.",
    "Reiniciar máquina de chapa — Carril 1": "Restart pinsetter — Lane 1",
    "Reiniciar máquina de chapa — Carril 2": "Restart pinsetter — Lane 2",
    "Reiniciar máquina de chapa — Carril 3": "Restart pinsetter — Lane 3",
    "ALGO HA ENTRADO EN LA BOLERA CONTIGO": "SOMETHING HAS ENTERED THE ALLEY WITH YOU",
    "LUCES FUERA — SOLO TU LINTERNA": "LIGHTS OUT — ONLY YOUR FLASHLIGHT",
    "BONNIE TE MIRA DESDE EL FONDO DEL CARRIL 4": "BONNIE IS WATCHING YOU FROM THE BACK OF LANE 4",
    "¡BONNIE VIENE DIRECTO A POR TI — ENCIENDE TODO Y CORRE!": "BONNIE IS COMING STRAIGHT FOR YOU — LIGHT EVERYTHING UP AND RUN!",
    "PRUEBA SUPERADA — Las máquinas cantan de nuevo. Bonnie se retira... por ahora.": "TRIAL CLEARED — The machines are singing again. Bonnie pulls back... for now.",
    # foodcourt
    "PRUEBA DE LA PLAZA DE COMIDA": "FOOD COURT TRIAL",
    "PRUEBA INICIADA — Rearranca los 3 puestos de comida antes del evento. Ella huele la pizza... y a ti.": "TRIAL STARTED — Restart the 3 food stands before the event. She can smell the pizza... and you.",
    "Rearranca el puesto — PIZZA": "Restart the stand — PIZZA",
    "Rearranca el puesto — PATATAS": "Restart the stand — FRIES",
    "Rearranca el puesto — HELADOS": "Restart the stand — ICE CREAM",
    "UNA RISA DE NIÑO RECORRE LA PLAZA DE COMIDA": "A CHILD'S LAUGH RUNS THROUGH THE FOOD COURT",
    "PASOS PEQUEÑOS... RÁPIDOS... ENTRE LAS MESAS": "SMALL FOOTSTEPS... FAST... BETWEEN THE TABLES",
    "CHICA ESTÁ JUNTO A LAS MESAS DEL FONDO — NO PARPADEA": "CHICA STANDS BY THE FAR TABLES — SHE DOESN'T BLINK",
    "LA PLAZA QUEDA A OSCURAS — ELLA NO NECESITA LUZ": "THE COURT GOES DARK — SHE DOESN'T NEED LIGHT",
    "PRUEBA SUPERADA — Los puestos rugen con energía. Chica se calma con el aroma... por ahora.": "TRIAL CLEARED — The stands roar with power. Chica settles down with the aroma... for now.",
    # cove
    "PRUEBA DE LA CALA DEL PIRATA": "PIRATE'S COVE TRIAL",
    "PRUEBA INICIADA — Restaura la energía de la atracción (3 interruptores, en orden). Foxy es MUY rápido. No dejes de moverte.": "TRIAL STARTED — Restore power to the attraction (3 switches, in order). Foxy is VERY fast. Keep moving.",
    "Interruptor de la atracción I": "Attraction switch I",
    "Interruptor de la atracción II": "Attraction switch II",
    "Interruptor de la atracción III": "Attraction switch III",
    "EL TELÓN DE LA CALA SE MECE SIN VIENTO": "THE COVE'S CURTAIN SWAYS WITH NO WIND",
    "FOXY ASOMA ENTRE LAS CORTINAS — EL OJO DEL PARCHE BRILLA": "FOXY POKES OUT BETWEEN THE CURTAINS — THE PATCHED EYE GLOWS",
    "LA CALA QUEDA A OSCURAS — SOLO SE OYE METAL": "THE COVE GOES DARK — ONLY METAL CAN BE HEARD",
    "¡FOXY CORRE! ¡LA LINTERNA LO FRENA UN INSTANTE — USA LA PUNTA DE TU VISTA!": "FOXY IS RUNNING! THE FLASHLIGHT STOPS HIM FOR AN INSTANT — KEEP HIM IN YOUR SIGHTS!",
    "PRUEBA SUPERADA — La atracción ruge con energía. Foxy regresa tras su telón, silbando.": "TRIAL CLEARED — The attraction roars with power. Foxy returns behind his curtain, whistling.",
    # generators
    "PRUEBA DE LOS GENERADORES": "GENERATORS TRIAL",
    "PRUEBA INICIADA — Fusible maestro: orden 3 · 1 · 4 · 2. TODOS los animatrónicos están despiertos. Y algo DORADO se ha levantado en la Sala Técnica.": "TRIAL STARTED — Master fuse: order 3 · 1 · 4 · 2. ALL animatronics are awake. And something GOLDEN has risen in the Technical Room.",
    "Interruptor maestro 3": "Master switch 3",
    "Interruptor maestro 1": "Master switch 1",
    "Interruptor maestro 4": "Master switch 4",
    "Interruptor maestro 2": "Master switch 2",
    "LA SALA DE GENERADORES zumba a oscuras": "THE GENERATOR ROOM HUMS IN THE DARK",
    "UNA SOMBRA PASA ENTRE LOS GENERADORES": "A SHADOW PASSES BETWEEN THE GENERATORS",
    "¡FREDDY TE HA VISTO — SEPARA LOS GENERADORES DE TU CAMINO!": "FREDDY HAS SEEN YOU — KEEP THE GENERATORS OUT OF HIS PATH!",
    "EL DORADO BLOQUEA LA PUERTA SUR": "THE GOLDEN ONE BLOCKS THE SOUTH DOOR",
    "PRUEBA SUPERADA — ENERGÍA RESTAURADA. El Complejo Bruno respira de nuevo. Ahora... a huir.": "TRIAL CLEARED — POWER RESTORED. The Bruno Complex breathes again. Now... run.",
    # sounds
    "EL PASILLO DE LOS SONIDOS": "THE HALLWAY OF SOUNDS",
    "LA GALERÍA TÉCNICA ESTÁ A CIEGAS. ESCUCHA LAS PUERTAS — RULO TE DIRÁ A CUÁL ENTRAR.": "THE TECHNICAL GALLERY IS BLIND DARK. LISTEN TO THE DOORS — RULO WILL TELL YOU WHICH ONE TO ENTER.",
    "LAS TRES PUERTAS CORRECTAS — EL SÓTANO TE ESPERA MÁS ABAJO…": "ALL THREE DOORS CORRECT — THE BASEMENT WAITS BELOW...",
    "RONDA 1 — Entra donde ZUMBA EL VENTILADOR (la sala vacía).": "ROUND 1 — Enter where the FAN HUMS (the empty room).",
    "RONDA 2 — Entra donde SUENAN LAS OLLAS (Chica ya se fue).": "ROUND 2 — Enter where the POTS CLANG (Chica already left).",
    "RONDA 3 — Entra donde hay SILENCIO de verdad.": "ROUND 3 — Enter where it is TRULY SILENT.",
    "Pasillo del taller": "Workshop hallway",
    "Cocina (ventilador)": "Kitchen (fan)",
    "Almacén norte": "North storage",
    "Muelle de carga": "Loading dock",
    "Sala eléctrica (ollas)": "Electrical room (pots)",
    "Congeladores": "Freezers",
    "Congeladores (silencio)": "Freezers (silence)",
    "Cocina": "Kitchen",
}

tr = json.load(open(f"{ROOT}/src/data/trials.json"))
miss2 = []
def walk_translate(obj):
    if isinstance(obj, dict):
        return {k: (TRIAL_MAP[v] if isinstance(v, str) and v in TRIAL_MAP else walk_translate(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [TRIAL_MAP[v] if isinstance(v, str) and v in TRIAL_MAP else walk_translate(v) for v in obj]
    return obj
tr2 = walk_translate(tr)
# comprobar qué quedó
def check(obj):
    if isinstance(obj, dict):
        for v in obj.values(): check(v)
    elif isinstance(obj, list):
        for v in obj: check(v)
    elif isinstance(obj, str) and any(c in "áéíóúñÁÉÍÓÚÑ¿¡" for c in obj):
        miss2.append(obj)
check(tr2)
json.dump(tr2, open(f"{ROOT}/src/data/trials.json", "w"), ensure_ascii=False, indent=1)
print(f"trials.json: {len(miss2)} restantes", miss2[:5])

# ============ MAP (nombres de salas y cámaras) ============
ROOM_MAP = {
    "Taller de Piezas": "Parts & Service",
    "Cocina Industrial": "Industrial Kitchen",
    "Almacén Norte": "North Storage",
    "Muelle de Carga": "Loading Dock",
    "Cuarto Eléctrico": "Electrical Room",
    "Cámaras Frías": "Cold Storage",
    "GALERÍA TÉCNICA — MANTENIMIENTO": "TECHNICAL GALLERY — MAINTENANCE",
    "ROCKSTAR ROW — GALERÍA": "ROCKSTAR ROW — GALLERY",
    "TEATRO MARIOPOLO": "MARIOPOLO THEATER",
    "FAZER BLAST — SALA LÁSER": "FAZER BLAST — LASER ARENA",
    "BONNIE BOWL — PISTA DE BOLOS": "BONNIE BOWL — LANES",
    "MOSTRADOR DE PREMIOS": "PRIZE COUNTER",
    "MONTY GOLF — MINIGOLF": "MONTY GOLF — MINIGOLF",
    "PASEO ROCKSTAR (N)": "ROCKSTAR PROMENADE (N)",
    "ATRIO CENTRAL — PLAZA FREDDY": "CENTRAL ATRIUM — FREDDY'S PLAZA",
    "PASEO FAZER (N)": "FAZER PROMENADE (N)",
    "LA CALA DEL PIRATA": "PIRATE'S COVE",
    "GUARDERÍA ESTRELLITA": "STELLAR DAYCARE",
    "PLAZA DE COMIDAS": "FOOD COURT",
    "Baños": "Restrooms",
    "Oficina de Seguridad": "Security Office",
    "Sala Técnica Sur": "South Technical Room",
    "VESTÍBULO PRINCIPAL": "MAIN LOBBY",
    "Sala de Generadores": "Generator Room",
    "Almacén Sur": "South Storage",
    "Sala de Bombas": "Pump Room",
    "SÓTANO — LA PIZZERÍA ORIGINAL (EN LLAMAS)": "BASEMENT — THE ORIGINAL PIZZERIA (ON FIRE)",
    "GALERÍA OESTE": "WEST GALLERY",
    "GALERÍA ESTE": "EAST GALLERY",
}
CAM_MAP = {
    "CAM 01 — Atrio Norte": "CAM 01 — North Atrium",
    "CAM 02 — Atrio Sur": "CAM 02 — South Atrium",
    "CAM 03 — Paseo Oeste": "CAM 03 — West Promenade",
    "CAM 04 — Paseo Este": "CAM 04 — East Promenade",
    "CAM 05 — Paseo Sur": "CAM 05 — South Promenade",
    "CAM 06 — Pasillo Técnico": "CAM 06 — Technical Hallway",
    "CAM 07 — Recreativo": "CAM 07 — Arcade",
    "CAM 08 — Cocina": "CAM 08 — Kitchen",
    "CAM 09 — Bolera": "CAM 09 — Bowling Alley",
    "CAM 10 — Guardería": "CAM 10 — Daycare",
    "CAM 11 — Cala Pirata": "CAM 11 — Pirate's Cove",
    "CAM 12 — Galería": "CAM 12 — Gallery",
    "CAM 13 — Teatro": "CAM 13 — Theater",
    "CAM 14 — Vestíbulo": "CAM 14 — Lobby",
}
m = json.load(open(f"{ROOT}/src/data/map.json"))
miss3 = []
for r in m["rooms"]:
    if r.get("name") in ROOM_MAP:
        r["name"] = ROOM_MAP[r["name"]]
    else:
        miss3.append(r.get("name"))
for c in m.get("cams", []):
    if c.get("name") in CAM_MAP:
        c["name"] = CAM_MAP[c["name"]]
    else:
        miss3.append(c.get("name"))
json.dump(m, open(f"{ROOT}/src/data/map.json", "w"), ensure_ascii=False, indent=1)
print(f"map.json: {len(miss3)} nombres sin traducir", miss3[:8])
print("HECHO")
