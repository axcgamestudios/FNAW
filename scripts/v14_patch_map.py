#!/usr/bin/env python3
"""
v14 — Campaña continua: ampliación del mapa para las 8 misiones.
- Exterior (parking + caseta del guardia) para M1.
- Túneles de servicio + archivo olvidado + vault para M5-M8.
- Fix iluminación oficina (ambient 0.85 -> 0.30).
- Cámaras nuevas (túneles, archivo, prize counter con musicBox).
- Escondites y baterías en las zonas nuevas.
"""
import json

PATH = '/home/z/my-project/src/data/map.json'
with open(PATH) as f:
    m = json.load(f)

# ---------- 1. LÍMITES DEL EDIFICIO ----------
m['building']['minZ'] = -87.5   # túneles subterráneos
m['building']['maxZ'] = 57.5    # parking exterior

# ---------- 2. FIX ILUMINACIÓN OFICINA (urgente) ----------
for r in m['rooms']:
    if r['id'] == 'office':
        r['ambientLight']['intensity'] = 0.30
        r['ambientLight']['flicker'] = 0.10

# ---------- 3. SALAS NUEVAS ----------
def room(id, name, rect, floor, wall, height, ambient, color=None, flicker=None, noCeiling=False):
    r = {
        'id': id, 'name': name, 'rect': rect, 'floor': floor, 'wall': wall,
        'height': height,
        'ambientLight': {'intensity': ambient, 'flicker': flicker if flicker is not None else 0.4},
    }
    if color is not None:
        r['ambientLight']['color'] = color
    if noCeiling:
        r['noCeiling'] = True
    return r

new_rooms = [
    # M1 — EXTERIOR: parking abandonado (sin techo = cielo nocturno)
    room('parking', 'ABANDONED PARKING LOT', [-44, 34.3, 44, 57.5],
         'concrete', 'concrete', 9, 0.05, color=0x2a3c55, flicker=0.5, noCeiling=True),
    # M1 — caseta del guardia (aquí está la llave)
    room('securityHut', "NIGHT GUARD'S HUT", [-30.5, 46.5, -24.5, 51.5],
         'concrete', 'concrete', 2.6, 0.14, color=0xffd9a8, flicker=0.3),
    # M5/M6 — TÚNELES DE SERVICIO
    room('tunnelA', 'SERVICE TUNNEL — VESTIBULE', [-30, -70, 18, -62.3],
         'concrete', 'concrete', 3.1, 0.05, color=0xcfc08a, flicker=0.6),
    room('tunnelMain', 'SERVICE TUNNEL — MAIN GALLERY', [-30, -76, 18, -70],
         'concrete', 'concrete', 2.9, 0.045, color=0xcfc08a, flicker=0.7),
    room('tunnelWest', 'FORGOTTEN STORAGE', [-30, -86.5, -24, -76],
         'concrete', 'rusty', 2.9, 0.04, color=0x9a8a5a, flicker=0.8),
    room('tunnelEast', 'SECURITY GATE TUNNEL', [12, -86.5, 18, -76],
         'concrete', 'metal', 2.9, 0.04, color=0x8a9aa5, flicker=0.65),
    # M7 — ARCHIVO OLVIDADO + vault
    room('archive', 'THE FORGOTTEN ARCHIVE', [-24, -86.5, 8, -76],
         'concrete', 'concrete', 3.2, 0.05, color=0xd8c9a0, flicker=0.5),
    room('archiveVault', 'RECORDS VAULT', [-14, -86.4, -7, -81],
         'metal', 'metal', 3.0, 0.07, color=0xffe9c0, flicker=0.25),
]
m['rooms'].extend(new_rooms)

# ---------- 4. MUROS ----------
def wall(x1, z1, x2, z2, wt, h, openings=None):
    w = {'x1': x1, 'z1': z1, 'x2': x2, 'z2': z2, 'wallType': wt, 'h': h}
    if openings:
        w['openings'] = openings
    return w

new_walls = [
    # EXTERIOR — perímetro del parking (la fachada sur del edificio ya existe en z=34)
    wall(-44, 34, -44, 57.5, 'concrete', 3.5),
    wall(44, 34, 44, 57.5, 'concrete', 3.5),
    wall(-44, 57.5, 44, 57.5, 'concrete', 3.0),   # valla sur del parking
    # Caseta del guardia (entrada al sur)
    wall(-30.5, 46.5, -30.5, 51.5, 'concrete', 2.6),
    wall(-30.5, 46.5, -24.5, 46.5, 'concrete', 2.6),
    wall(-24.5, 46.5, -24.5, 51.5, 'concrete', 2.6),
    wall(-30.5, 51.5, -24.5, 51.5, 'concrete', 2.6,
         [{'at': -27.5, 'width': 1.4, 'height': 2.2}]),
    # TÚNELES — vestíbulo bajo el sótano
    wall(-30, -70, -30, -62.3, 'concrete', 3.1),
    wall(18, -70, 18, -62.3, 'concrete', 3.1),
    wall(-30, -70, 18, -70, 'concrete', 3.1,
         [{'at': 0, 'width': 3.5, 'height': 2.4}]),          # paso vestíbulo -> galería
    # Galería principal
    wall(-30, -76, -30, -70, 'concrete', 2.9),
    wall(18, -76, 18, -70, 'concrete', 2.9),
    wall(-30, -76, 18, -76, 'concrete', 2.9, [
        {'at': -27, 'width': 2.4, 'height': 2.2},            # paso almacen oeste
        {'at': -7, 'width': 2.8, 'height': 2.4},             # DOOR_ARCHIVE
        {'at': 15, 'width': 2.4, 'height': 2.2},             # paso portón este
    ]),
    # Almacén olvidado (oeste)
    wall(-30, -86.5, -30, -76, 'rusty', 2.9),
    wall(-24, -86.5, -24, -76, 'rusty', 2.9,
         [{'at': -81, 'width': 2.2, 'height': 2.2}]),        # paso archivo <-> almacen
    # Archivo — muro este (separa del túnel del portón)
    wall(8, -86.5, 8, -76, 'concrete', 3.2),
    # Túnel del portón — muro oeste
    wall(12, -86.5, 12, -76, 'metal', 2.9),
    # Muro sur global de los túneles con el PORTÓN DE SEGURIDAD
    wall(-30, -86.5, 18, -86.5, 'metal', 3.0,
         [{'at': 15, 'width': 2.6, 'height': 2.5}]),
    # VAULT dentro del archivo
    wall(-14, -86.5, -14, -81, 'metal', 3.0),
    wall(-14, -81, -7, -81, 'metal', 3.0,
         [{'at': -10.5, 'width': 1.5, 'height': 2.2}]),      # DOOR_VAULT
    wall(-7, -86.5, -7, -81, 'metal', 3.0),
]
m['walls'].extend(new_walls)

# Opening de la RUTA DE EMERGENCIA en el muro sur del sótano (z=-62)
for w in m['walls']:
    if w['x1'] == -44 and w['z1'] == -62 and w['x2'] == 44 and w['z2'] == -62:
        w.setdefault('openings', []).append({'at': -3, 'width': 2.6, 'height': 2.7})

# ---------- 5. PUERTAS ----------
# door_exit ahora conecta con el parking real
for d in m['doors']:
    if d['id'] == 'door_exit':
        d['roomB'] = 'parking'
        d['lockedMsg'] = 'THE FRONT DOORS ARE CHAINED — FIND THE SPARE KEY'

m['doors'].extend([
    {'id': 'door_tunnel', 'x': -3, 'z': -62, 'axis': 'x', 'width': 2.6,
     'roomA': 'megadaycare', 'roomB': 'tunnelA', 'locked': True,
     'lockedMsg': 'EMERGENCY ROUTE — KILL THE BASEMENT INFERNO FIRST'},
    {'id': 'door_archive', 'x': -7, 'z': -76, 'axis': 'x', 'width': 2.8,
     'roomA': 'tunnelMain', 'roomB': 'archive', 'locked': True,
     'lockedMsg': 'RECORDS ROOM — UNSEAL IT FROM THE TUNNEL RELAYS'},
    {'id': 'door_vault', 'x': -10.5, 'z': -81, 'axis': 'x', 'width': 1.5,
     'roomA': 'archive', 'roomB': 'archiveVault', 'locked': True,
     'code': '1987', 'lockedMsg': 'VAULT TERMINAL — 4-DIGIT YEAR OF THE SECOND INCIDENT'},
    {'id': 'door_security_gate', 'x': 15, 'z': -86.5, 'axis': 'x', 'width': 2.6,
     'roomA': 'tunnelEast', 'roomB': 'gateOutside', 'locked': True,
     'lockedMsg': 'SECURITY GATE — MASTER KEYCARD REQUIRED'},
])

# ---------- 6. CÁMARAS ----------
m['cams'].extend([
    {'index': 15, 'name': 'CAM 15 — Service Tunnels', 'room': 'tunnelMain',
     'pos': [-6, 2.6, -73], 'look': [8, 1.0, -73]},
    {'index': 16, 'name': 'CAM 16 — The Archive', 'room': 'archive',
     'pos': [-20, 2.8, -78], 'look': [-10, 1.2, -82]},
    {'index': 17, 'name': 'CAM 17 — Prize Counter (MUSIC BOX)', 'room': 'prize',
     'pos': [16, 3.2, -10.4], 'look': [23, 1.2, -14], 'musicBox': True},
])

# ---------- 7. ESCONDES ----------
def spot(id, room_, x, z, type_, lx, lz):
    return {'id': id, 'room': room_, 'pos': [x, z], 'type': type_, 'look': [lx, lz]}

m['hidingSpots'].extend([
    spot('car_parking_1', 'parking', -16, 45, 'crate', -16, 39),
    spot('car_parking_2', 'parking', 8, 48, 'crate', 8, 42),
    spot('rack_tunnel_w', 'tunnelWest', -28, -84, 'rack', -28, -79),
    spot('rack_tunnel_e', 'tunnelEast', 14.2, -84.5, 'rack', 15, -80),
    spot('shelf_archive', 'archive', -16, -78.5, 'rack', -16, -83),
    spot('shelf_archive2', 'archive', 4, -84.5, 'rack', 4, -80),
])

# ---------- 8. BATERÍAS en las zonas nuevas ----------
m['batterySpots'].extend([
    [-28, -68], [-27, -83], [13, -77.5], [-5, 52], [20, 44], [34, 50], [-12, -73], [2, -83],
])

with open(PATH, 'w') as f:
    json.dump(m, f, indent=1)
    f.write('\n')

print('map.json v14 OK')
print('rooms:', len(m['rooms']), '| walls:', len(m['walls']), '| doors:', len(m['doors']),
      '| cams:', len(m['cams']), '| hides:', len(m['hidingSpots']), '| batteries:', len(m['batterySpots']))
