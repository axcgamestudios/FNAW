#!/usr/bin/env python3
"""v9 — REORDEN DE CAPÍTULOS (fin de partida como pidió el usuario):
  cap4 = La Cala del Pirata        (antes cap5)
  cap5 = Los Generadores           (antes cap6)
  cap6 = NUEVO: El Pasillo de los Sonidos  (puzzle auditivo estilo FNAF 4)
  cap7 = El Sótano en Llamas       (Sol y Luna al FINAL, antes cap4)
         + la fuga integrada al triunfo (la salida se abre al ganar)

También reordena trials.json: cove→4, generators→5, sunmoon→7,
y añade la prueba 'sounds' (cap 6).
"""
import json

CP = "/home/z/my-project/src/data/chapters.json"
TP = "/home/z/my-project/src/data/trials.json"

ch = json.load(open(CP, encoding="utf-8"))["chapters"]
tr = json.load(open(TP, encoding="utf-8"))["trials"]

by_title = {c["title"]: c for c in ch}
by_tid = {t["id"]: t for t in tr}

# ---------- cap 4: La Cala del Pirata ----------
cove = dict(by_title["La Cala del Pirata"])
cove["chapter"] = 4
cove["enemies"] = ["freddy", "bonnie", "chica", "foxy"]
cove["aggression"] = 1.1
cove["startPower"] = 70

# ---------- cap 5: Los Generadores ----------
gen = dict(by_title["Los Generadores"])
gen["chapter"] = 5
gen["enemies"] = ["freddy", "bonnie", "chica", "foxy"]
gen["aggression"] = 1.3
gen["startPower"] = 60

# ---------- cap 6: NUEVO — El Pasillo de los Sonidos ----------
cap6 = {
    "chapter": 6,
    "id": "c6_sounds",
    "title": "El Pasillo de los Sonidos",
    "enemies": ["freddy", "bonnie"],
    "aggression": 1.35,
    "eventRate": 1.25,
    "startPower": 65,
    "lines": [
        "*clic* …Rulo otra vez. La red se va cayendo por zonas.",
        "Toda la GALERÍA TÉCNICA está a oscuras. Solo quedan las rojas de emergencia.",
        "No puedes ver qué hay detrás de cada puerta de servicio… pero PUEDES OÍRLO.",
        "Escucha el sonido de cada puerta. Yo te diré a cuál entrar. Si te equivocas…",
        "…bueno. Conoces a los de dentro. Buena suerte.",
    ],
    "radio": {
        "atMinute": 0.18,
        "lines": [
            "*clic* ¿Sigues ahí? Soy Rulo. La galería técnica se ha quedado a oscuras.",
            "Seis puertas de servicio y solo UNA forma de saber qué hay detrás: el SONIDO.",
            "Un VENTILADOR zumba donde no hay nadie. Las OLLAS suenan donde Chica desmonta la cocina.",
            "Si oyes pasos pesados o una risa metálica… esa puerta NO. No la abras. Jamás.",
            "Te guiaré ronda a ronda. Escucha antes de moverte. Confía en las orejas, no en los ojos.",
        ],
    },
    "objectives": [
        {"id": "c6_enter", "type": "goto", "label": "Llega a la Galería Técnica (a oscuras)", "room": "techHall"},
        {"id": "c6_trial", "type": "trial", "label": "Supera las rondas de sonidos (3)"},
    ],
    "introCinematic": None,
    "outroCinematic": None,
}

# ---------- cap 7: El Sótano en Llamas (Sol y Luna + fuga) ----------
old_inferno = by_title["El Infierno de la Mega Guardería"]
old_escape = by_title["La Fuga"]
inferno = dict(old_inferno)
inferno["chapter"] = 7
inferno["id"] = "c7_basement"
inferno["title"] = "El Sótano en Llamas"
inferno["enemies"] = ["luna", "freddy"]
inferno["aggression"] = 1.6
inferno["startPower"] = 70
inferno["radio"] = {
    "atMinute": 0.2,
    "lines": [
        "*clic* …Rulo. Lo has encontrado. El SÓTANO. Lo que queda de la pizzería ORIGINAL.",
        "El fuego lleva AÑOS comiéndoselo. Y algo con una cara de luna vive ahí abajo.",
        "Siete fuegos, siete extintores. Mátalos todos y la luz lo cambiará todo.",
        "Cuando brille el Sol… CORRE A LA SALIDA DEL VESTÍBULO. No mires atrás.",
        "Sea lo que sea lo que fuiste esta noche… termina AQUÍ.",
    ],
}
# objetivos: la prueba + la fuga final
inferno["objectives"] = list(old_inferno["objectives"]) + [
    {"id": "c7_escape", "type": "goto", "label": "CORRE a la SALIDA del vestíbulo", "room": "lobby"},
]
inferno["introCinematic"] = "cine_inferno"
inferno["outroCinematic"] = None   # la huida es jugable; el final va tras la puerta

# ---------- ensamblar ----------
new_chapters = [ch[0], ch[1], ch[2], cove, gen, cap6, inferno]
new_chapters = sorted(new_chapters, key=lambda c: c["chapter"])
assert [c["chapter"] for c in new_chapters] == [1, 2, 3, 4, 5, 6, 7]

json.dump({"chapters": new_chapters}, open(CP, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# ---------- trials ----------
by_tid["cove"]["chapter"] = 4
by_tid["generators"]["chapter"] = 5
by_tid["sunmoon"]["chapter"] = 7
by_tid["sunmoon"]["name"] = "EL SÓTANO EN LLAMAS — SOL Y LUNA"

# prueba del puzzle auditivo
sounds_trial = {
    "id": "sounds",
    "name": "EL PASILLO DE LOS SONIDOS",
    "chapter": 6,
    "room": "techHall",
    "type": "sounds",
    "hunter": "freddy",
    "hunterResetRoom": "techHall",
    "hunterResetPos": [-42, -20.5],
    "respawnRoom": "techHall",
    "respawnPos": [0, -19.5],
    "respawnYaw": 0,
    "aggression": 1.0,
    "darkFromStart": True,
    "introMsg": "LA GALERÍA TÉCNICA ESTÁ A CIEGAS. ESCUCHA LAS PUERTAS — RULO TE DIRÁ A CUÁL ENTRAR.",
    "successMsg": "LAS TRES PUERTAS CORRECTAS — EL SÓTANO TE ESPERA MÁS ABAJO…",
    "rounds": [
        {
            "hint": "RONDA 1 — Entra donde ZUMBA EL VENTILADOR (la sala vacía).",
            "doors": [
                {"door": "door_workshop", "sound": "steps", "label": "Pasillo del taller"},
                {"door": "door_kitchen", "sound": "fan", "label": "Cocina (ventilador)"},
                {"door": "door_storageN", "sound": "laugh", "label": "Almacén norte"},
            ],
            "safe": "door_kitchen",
        },
        {
            "hint": "RONDA 2 — Entra donde SUENAN LAS OLLAS (Chica ya se fue).",
            "doors": [
                {"door": "door_loading", "sound": "fan", "label": "Muelle de carga"},
                {"door": "door_electrical", "sound": "kitchen", "label": "Sala eléctrica (ollas)"},
                {"door": "door_freezers", "sound": "steps", "label": "Congeladores"},
            ],
            "safe": "door_electrical",
        },
        {
            "hint": "RONDA 3 — Entra donde hay SILENCIO de verdad.",
            "doors": [
                {"door": "door_workshop", "sound": "laugh", "label": "Pasillo del taller"},
                {"door": "door_kitchen", "sound": "steps", "label": "Cocina"},
                {"door": "door_freezers", "sound": "none", "label": "Congeladores (silencio)"},
            ],
            "safe": "door_freezers",
        },
    ],
    "tasks": [],   # las rondas usan su propio mecanismo
    "scares": [],
}
# quitar la vieja si existiera y añadir
tr = [t for t in tr if t.get("id") != "sounds"]
tr.append(sounds_trial)
json.dump({"trials": tr}, open(TP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("CAPÍTULOS v9:")
for c in new_chapters:
    print(f"  cap{c['chapter']}: {c['title']}")
print("TRIALS v9:")
for t in tr:
    print(f"  {t['id']} → cap {t['chapter']}")
