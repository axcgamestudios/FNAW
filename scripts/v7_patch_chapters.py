#!/usr/bin/env python3
"""v7: chapters.json (7 capítulos — sunmoon en la MITAD, cap 4),
cinematics.json (cine_inferno + amanecer en llamas) y animatronics.json (7 entradas)."""
import json

CH = "/home/z/my-project/src/data/chapters.json"
CI = "/home/z/my-project/src/data/cinematics.json"
AN = "/home/z/my-project/src/data/animatronics.json"

# ============ CAPÍTULOS ============
chapters = json.load(open(CH))["chapters"]
by = {c["chapter"]: c for c in chapters}

# ---- cap1: puro escape sigiloso (sin prueba) ----
cap1 = by[1]
cap1["outroCinematic"] = "cine_exit_daycare"
cap1["enemies"] = ["luna"]
cap1["lines"] = [
    "Complejo Bruno MEGAPLEX — 11:58 PM.",
    "Te colaste a medianoche. Mal idea.",
    "Las luces mueren, las rejas bajan...",
    "y LUNA escucha cada pelota que se mueve.",
]
cap1["radio"]["lines"] = [
    "*clic* — ¿Hola? ¿Hay alguien...? ¡Un crío! ¿Cómo demonios entraste?",
    "Soy Rulo, del turno anterior. Escucha bien: estás en la SUPER GUARDERÍA, escondido en la alberca de pelotas.",
    "LUNA patrulla ahí dentro. Casi no ve... pero lo oye TODO. En las pelotas, cada paso tuyo suena al doble y medio.",
    "Primero: sal de la alberca AGACHADO [Ctrl] y sin correr. Cuando pases, no mires atrás.",
    "Segundo: alguien perdió una LINTERNA en la torre de juegos, al fondo. Súbete a por ella. Sin luz, esta guardería es una tumba.",
    "Tercero: cuando la tengas, ve a cualquier reja. La abriré desde aquí. Sal al paseo y no pares.",
    "Si te atrapa... despertarás de nuevo en la alberca. Lo he visto antes. Y otra vez. Y otra vez.",
    "Ve. Ahora. Mientras cante la nana.",
]
cap1["objectives"] = [
    {"id": "c1_sneak", "title": "Sal de la alberca sin despertar a LUNA", "hint": "Agachado [Ctrl], sin correr", "type": "system", "target": "pit_escaped"},
    {"id": "c1_torch", "title": "Recupera la linterna de la torre de juegos", "hint": "Al fondo de la guardería [E]", "type": "interact", "room": "daycare", "target": "daycare_torch"},
    {"id": "c1_exit", "title": "Sal de la Guardería", "hint": "Cualquiera de las rejas — Rulo las abrirá", "type": "system", "target": "daycare_escaped"},
]

# ---- cap4 NUEVO: el infierno de la Mega Guardería ----
inferno = {
    "chapter": 4,
    "id": "cap4",
    "title": "El Infierno de la Mega Guardería",
    "enemies": ["luna", "freddy"],
    "aggression": 1.05,
    "eventRate": 1.1,
    "startPower": 70,
    "introCinematic": "cine_inferno",
    "outroCinematic": "cine_sunrise",
    "lines": [
        "La noche ya lleva tres pruebas encima.",
        "Y ahora el MEGAPLEX huele a plástico quemado.",
        "La MEGA GUARDERÍA arde. Y LUNA canta entre las llamas.",
    ],
    "radio": {
        "atMinute": 0.22,
        "lines": [
            "*clic* — ¡¿Sigues vivo?! Escucha: la MEGA GUARDERÍA está ARDIENDO. Alguien la encendió hace media hora.",
            "Es la guardería GIGANTE del fondo norte, tras el taller. Las puertas cortafuego están abiertas de par en par.",
            "LUNA vive ahí. Y esta noche está... feliz. Canta. El incendio es SU fiesta de cumpleaños.",
            "Hay SIETE extintores anclados por la sala. Úsalos TODOS. Cada fuego que apagues... la enfadará un poco más.",
            "Reglas: no corras, te oye. No toques las llamas, muerden de verdad. Y si te coge... ya sabes dónde despertarás.",
            "Cuando muera el último fuego, volverá la luz. Y LUNA se convertirá en SOL. Ese es el truco. Siempre lo ha sido.",
            "Ve. Y chico... la nana que oigas ahí dentro NO es para ti.",
        ],
    },
    "objectives": [
        {"id": "c4_trial", "title": "APAGA EL INFIERNO: 7 extintores", "hint": "Mega Guardería — 7 fuegos, ni uno menos", "type": "trial", "target": "sunmoon"},
    ],
}

# ---- renumerar los antiguos cap4/5/6 → 5/6/7 ----
cove = by[4]
cove["chapter"] = 5
cove["id"] = "cap5"
cove["outroCinematic"] = "cine_cap5"

gen = by[5]
gen["chapter"] = 6
gen["id"] = "cap6"
gen["outroCinematic"] = None

fuga = by[6]
fuga["chapter"] = 7
fuga["id"] = "cap7"
# el objetivo de fuga sigue llamándose c6_escape/c6_key* — se actualizan para no romper refs
fuga["objectives"] = [
    {"id": "c7_key1", "title": "Tarjeta de acceso — Galería Estelar", "hint": "Sobre el pedestal de la estatua", "type": "interact", "room": "rockstar", "target": "key_rockstar"},
    {"id": "c7_key2", "title": "Tarjeta de acceso — Teatro Bruno", "hint": "En la primera fila de butacas", "type": "interact", "room": "theater", "target": "key_theater"},
    {"id": "c7_key3", "title": "Tarjeta de acceso — Plaza de Comida", "hint": "En una mesa central", "type": "interact", "room": "foodcourt", "target": "key_foodcourt"},
    {"id": "c7_escape", "title": "ESCAPA por los tornos del vestíbulo", "hint": "Puerta doble del vestíbulo sur", "type": "interact", "room": "lobby", "target": "exit_door"},
]

# renumerar objetivos internos de cove/generators (c4_*→c5_*, c5_*→c6_*)
for o in cove["objectives"]:
    o["id"] = o["id"].replace("c4_", "c5_")
for o in gen["objectives"]:
    o["id"] = o["id"].replace("c5_", "c6_")

# la cinta de la cala era c4_tape → c5_tape
for o in cove["objectives"]:
    if o["id"] == "c4_tape":
        o["id"] = "c5_tape"

new_chapters = [by[1], by[2], by[3], inferno, cove, gen, fuga]
new_chapters.sort(key=lambda c: c["chapter"])
json.dump({"chapters": new_chapters}, open(CH, "w"), ensure_ascii=False, indent=2)

# ============ CINEMÁTICAS ============
cines = json.load(open(CI))

cines["cine_exit_daycare"] = {
    "letterbox": True,
    "actors": [],
    "shots": [
        {"pos": [-22.5, 1.9, 10.0], "look": [-22.5, 1.2, -1.0], "dur": 4.2,
         "text": "Las rejas se abren con un gemido. El paseo norte te traga."},
        {"pos": [-22.5, 2.3, -1.5], "look": [-10, 3.5, -6.0], "dur": 4.5,
         "text": "El MEGAPLEX entero espera a oscuras. Y algo, ahí fuera, ya sabe tu nombre."},
    ],
}

cines["cine_inferno"] = {
    "letterbox": True,
    "actors": [
        {"id": "luna", "pos": [-24, 0, -44], "yaw": 0.9},
    ],
    "shots": [
        {"pos": [-38, 2.6, -36.5], "look": [0, 2.5, -50], "dur": 5.0,
         "text": "La MEGA GUARDERÍA. Dos mil quinientos metros cuadrados de infierno."},
        {"pos": [-24.5, 2.0, -41.5], "look": [-24, 1.7, -44], "dur": 4.2,
         "text": "Entre el humo, LUNA te espera. Quieta. Sonriendo. Cantando."},
        {"pos": [0, 1.8, -40.0], "look": [0, 7.0, -48], "dur": 4.2,
         "text": "Sobre el centro del techo cuelga su percha. Por si quiere volver a subir."},
        {"pos": [-30, 2.2, -37.5], "look": [-30, 1.0, -39.2], "dur": 4.0,
         "text": "Siete incendios. Siete extintores. Ninguna salida hasta el último."},
    ],
}

# amanecer reescrito para la versión en llamas
cines["cine_sunrise"] = {
    "letterbox": True,
    "actors": [
        {"id": "luna", "pos": [0, 0, -46], "yaw": 0.4},
    ],
    "shots": [
        {"pos": [-4.5, 2.3, -40.5], "look": [0, 1.9, -46], "dur": 4.2,
         "text": "El último fuego muere con un siseo. La Mega Guardería respira."},
        {"pos": [-1.8, 2.0, -44.6], "look": [0, 2.1, -46], "dur": 4.4,
         "text": "LUNA se retira... y SOL despierta entre el vapor. Sonríe. Casi es peor."},
        {"pos": [0, 2.7, -52.5], "look": [0, 1.6, -40], "dur": 4.2,
         "text": "Las puertas cortafuego se abren de golpe. El MEGAPLEX sigue esperando."},
    ],
}

json.dump(cines, open(CI, "w"), ensure_ascii=False, indent=2)

# ============ ANIMATRÓNICOS (7 capítulos) ============
an = json.load(open(AN))
for a in an["animatronics"]:
    aid = a["id"]
    if aid == "freddy":
        a["activeChapters"] = [1, 2, 3, 4, 5, 6, 7]
        a["wakeDelay"] = [150, 60, 45, 50, 40, 30, 15]
    elif aid == "bonnie":
        a["activeChapters"] = [2, 3, 4, 5, 6, 7]
        a["wakeDelay"] = [999, 40, 30, 30, 25, 20, 10]
    elif aid == "chica":
        a["activeChapters"] = [3, 4, 5, 6, 7]
        a["wakeDelay"] = [999, 999, 35, 35, 25, 20, 10]
    elif aid == "foxy":
        a["activeChapters"] = [5, 6, 7]
        a["wakeDelay"] = [999, 999, 999, 999, 25, 18, 8]
    elif aid == "luna":
        a["activeChapters"] = [1, 4]
        a["wakeDelay"] = [0, 999, 999, 999, 999, 999, 999]  # cap4: despierta al DESCENDER
        a["patrolRooms"] = ["daycare", "megadaycare"]
        a["speedRun"] = 4.5
    elif aid == "golden":
        a["activeChapters"] = [6, 7]
        a["wakeDelay"] = [999, 999, 999, 999, 999, 999, 0]

json.dump(an, open(AN, "w"), ensure_ascii=False, indent=2)

print("chapters:", [c["title"] for c in new_chapters])
print("cines nuevas: cine_exit_daycare, cine_inferno, cine_sunrise(v2)")
print("animatronics OK")
