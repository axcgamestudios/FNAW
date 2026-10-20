#!/usr/bin/env python3
"""v14 — cinemáticas de transición para M6 (túneles) y M8 (persecución final)."""
import json

PATH = '/home/z/my-project/src/data/cinematics.json'
with open(PATH) as f:
    c = json.load(f)

c['cine_tunnels'] = {
    "letterbox": True,
    "actors": [{"id": "jeremy", "pos": [-3, 0, -65], "yaw": 3.2}],
    "shots": [
        {"pos": [-3, 1.7, -61.5], "look": [-3, 2.2, -70], "dur": 4,
         "text": "The emergency route. A black mouth under the burning basement."},
        {"pos": [-16, 2.2, -72.5], "look": [-28, 1.6, -73], "dur": 4,
         "text": "Service tunnels. Older than the mall. Older than the rumors."},
        {"pos": [15, 1.8, -80], "look": [15, 2.2, -86.2], "dur": 4,
         "text": "A SECURITY GATE at the end of the east tunnel. The way to the surface."},
        {"pos": [-3, 1.7, -66], "look": [-26, 1.5, -79], "dur": 3.5,
         "text": "And in the pipes... something that never left."},
    ],
}

c['cine_chase'] = {
    "letterbox": True,
    "actors": [{"id": "jeremy", "pos": [-8, 0, -80.5], "yaw": 2.6}],
    "shots": [
        {"pos": [-10.5, 1.6, -83.5], "look": [-10.5, 1.2, -84.5], "dur": 3.5,
         "text": "The MASTER KEYCARD. The last door of the Bruno Complex."},
        {"pos": [15, 1.8, -82], "look": [15, 2.4, -86.2], "dur": 3.5,
         "text": "One override. Ninety seconds of screaming metal."},
        {"pos": [-16, 2.3, -73], "look": [4, 1.4, -73], "dur": 3.5,
         "text": "Whatever happens... the gate is the only way out."},
        {"pos": [-8, 1.7, -80.5], "look": [15, 1.6, -86], "dur": 3,
         "text": "Run. Don't look back. End the shift."},
    ],
}

with open(PATH, 'w') as f:
    json.dump(c, f, indent=1)
    f.write('\n')

print('cinematics.json OK — total:', list(c.keys()))
