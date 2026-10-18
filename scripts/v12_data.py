#!/usr/bin/env python3
"""v12 — DATA PATCH: remove daycare, 5-extinguisher burning basement,
Moon only at the end, longer missions, English texts."""
import json, copy, sys

ROOT = '/home/z/my-project/src/data'

def load(p):
    with open(f'{ROOT}/{p}', encoding='utf-8') as f:
        return json.load(f)

def save(p, d):
    with open(f'{ROOT}/{p}', 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    print(f'  ✓ {p} written')

# ============ 1. MAP.JSON ============
m = load('map.json')

# --- small daycare room -> WEST STORAGE annex ---
for r in m['rooms']:
    if r['id'] == 'daycare':
        r['name'] = 'WEST STORAGE — ARCHIVES'
        r['floor'] = 'concrete'
        r['wall'] = 'concrete'
        r['ambientLight'] = {'intensity': 0.07, 'color': 0x3a4a3a, 'flicker': 0.55}
    if r['id'] == 'megadaycare':
        r['name'] = 'THE BASEMENT — ORIGINAL PIZZERIA (BURNING)'
        r['wall'] = 'cracked'
        r['ambientLight'] = {'intensity': 0.42, 'color': 0xff9860, 'flicker': 0.4}

# --- gates around old daycare: always open now (no daycare to guard) ---
for d in m['doors']:
    if d['id'].startswith('gate_daycare'):
        d['locked'] = False
        d['lockedMsg'] = 'SECURITY GATE'
    if d['id'].startswith('door_mega'):
        d['lockedMsg'] = 'FIRE DOOR — THE BASEMENT BURNS BEHIND IT. 3 KEYCARDS REQUIRED'

# --- cams ---
for c in m['cams']:
    if c['index'] == 10:
        c['name'] = 'CAM 10 — West Storage'
    if c['index'] == 13:
        c['name'] = 'CAM 13 — The Basement'
    if c['index'] == 5 and 'Daycare' in c.get('name', ''):
        c['name'] = 'CAM 05 — South Promenade'

# --- hiding spot chest_mega_1 clear of the new rack row A (z=-40) ---
for h in m['hidingSpots']:
    if h['id'] == 'chest_mega_1':
        h['pos'] = [-25, -37.8]

save('map.json', m)

# ============ 2. ANIMATRONICS.JSON — Moon only at the END ============
a = load('animatronics.json')
for an in a['animatronics']:
    if an['id'] == 'luna':
        an['activeChapters'] = [7]
        an['startRoom'] = 'megadaycare'
save('animatronics.json', a)

# ============ 3. TRIALS.JSON — sunmoon: 5 extinguishers, harder, scarier ============
t = load('trials.json')
tr = {x['id']: x for x in t['trials']}
sm = tr['sunmoon']
sm['name'] = 'THE BURNING BASEMENT — SUN AND MOON'
sm['introMsg'] = ('THE BASEMENT OF THE ORIGINAL PIZZERIA — AN INFERNO OF RACKS AND CRATES. '
                  'MOON DROPS FROM THE CEILING. Find the 5 EXTINGUISHERS and kill the fires. '
                  'Stay crouched: it HEARS everything. And the flames bite TOO.')
sm['aggression'] = 2.15
sm['respawnPos'] = [-36.0, -36.4]
sm['hunterResetPos'] = [-10.0, -60.0]
sm['tasks'] = [
    {'id': 'e5', 'label': 'Extinguisher — NW, at the rack gap',        'at': [-34.5, -36.5], 'hold': 5.5},
    {'id': 'e3', 'label': 'Extinguisher — north-center, by the pipes', 'at': [7.0, -37.5],   'hold': 5.5},
    {'id': 'e2', 'label': 'Extinguisher — south-west, behind lockers', 'at': [-13.0, -58.5], 'hold': 5.5},
    {'id': 'e4', 'label': 'Extinguisher — north-east corner',          'at': [39.5, -38.0],  'hold': 5.5},
    {'id': 'e1', 'label': 'Extinguisher — far south-west corner',      'at': [-42.0, -56.0], 'hold': 5.5},
]
sm['scares'] = [
    {'at': 'start', 'type': 'moonDescend', 'pos': [-24.0, -44.0],
     'msg': 'MOON LETS GO OF THE CEILING AND DROPS FEW METERS AWAY — THE GAME BEGINS'},
    {'at': 'start', 'type': 'ventBang', 'msg': 'SOMETHING HUGE MOVES BEHIND THE RACKS'},
    {'at': 'task1', 'type': 'lullaby',
     'msg': "THE OLD PIZZERIA'S SONG PLAYS AMONG THE FLAMES... CLOSER AND CLOSER"},
    {'at': 'task1', 'type': 'fakeSteps',
     'msg': 'SOFT FOOTSTEPS... CIRCLING YOU... BETWEEN THE SHELVES'},
    {'at': 'task2', 'type': 'hunterAppear', 'pos': [-30.0, -55.0],
     'msg': 'MOON STANDS AT THE END OF THE AISLE — STILL — SMILING THROUGH THE SMOKE'},
    {'at': 'task2', 'type': 'childLaugh',
     'msg': "A CHILD'S LAUGH ECHOES FROM THE SPARE-PARTS SHELF"},
    {'at': 'task3', 'type': 'moonScream',
     'msg': 'MOON SHRIEKS — IT KNOWS WHERE YOU ARE — THE SMOKE GIVES YOU AWAY'},
    {'at': 'task3', 'type': 'fakeSteps',
     'msg': 'MORE FOOTSTEPS — FASTER — FROM EVERY AISLE AT ONCE'},
    {'at': 'task4', 'type': 'lightsOut', 'dur': 9,
     'msg': "THE FIRE'S ROAR GOES SILENT FOR A SECOND — ONLY YOUR FLASHLIGHT REMAINS"},
    {'at': 'task4', 'type': 'ventBang', 'msg': 'A LOCKER SLAMS SOMEWHERE IN THE DARK'},
    {'at': 'task5', 'type': 'hunterChase',
     'msg': "LAST FIRE — MOON ISN'T HIDING ANYMORE — RUN!"},
    {'at': 'task5', 'type': 'moonScream',
     'msg': 'THE MOON-FACE SCREAMS ONE LAST TIME'},
]
sm['successMsg'] = ('THE LAST FIRE DIES. The basement finally breathes... MOON retreats and SUN '
                    'wakes up in the steam. The fire doors burst open. RUN TO THE EXIT.')
save('trials.json', t)

# ============ 4. CINEMATICS.JSON ============
c = load('cinematics.json')
inf = c['cine_inferno']['shots']
inf[0]['text'] = 'THE BASEMENT. What is left of the original pizzeria — an inferno of steel racks and ash.'
inf[0]['look'] = [0, 2.5, -50]
inf[1]['text'] = 'Through the smoke, MOON waits for you. Still. Smiling. Singing.'
inf[3]['text'] = 'Five fires. Five extinguishers. No way out until the last one.'
c['cine_sunrise']['shots'][0]['text'] = 'The last fire dies with a hiss. The basement breathes again.'
# cine_first_dawn: fine. cine_arrival: fine.
save('cinematics.json', c)

# ============ 5. STORY.JSON — scrub daycare lore ============
s = load('story.json')
for tp in s['tapes']:
    if tp['id'] == 'tape_w4':
        tp['text'] = ("11/11/1993 — The archives' music box stops by itself mid-melody. When it stops, "
                      "the chicken gets up from behind the crates and walks. I found her by the door, "
                      "standing, facing the wall. I put her back. The mechanism was intact. The spring "
                      "was still wound. The melody calms her. For as long as it lasts.")
    if 'Bowling, Daycare' in tp.get('text', ''):
        tp['text'] = tp['text'].replace('Bowling, Daycare, Cove, Generators',
                                        'Bowling, the Food Court, the Cove, the Generators')
save('story.json', s)

# ============ 6. CHAPTERS.JSON — LONGER MISSIONS ============
ch = load('chapters.json')
chapters = ch['chapters']

def set_chapter(n, **kw):
    for x in chapters:
        if x['chapter'] == n:
            x.update(kw)
            return x
    raise SystemExit(f'chapter {n} not found')

# ---- CAP 1: The First Shift — flashlight from the START, long patrol ----
set_chapter(1,
    enemies=['freddy'], aggression=0.5, eventRate=0.6, startPower=100,
    introCinematic='cine_arrival', outroCinematic='cine_first_dawn',
    lines=[
        'Bruno MEGAPLEX — 11:47 PM.',
        'First shift as the night guard. First mistake: showing up.',
        'You signed the contract. The rules were written by something else.',
        'Your flashlight is already on your belt. Small mercies.',
    ],
    radio={'atMinute': 0.25, 'lines': [
        "*click* — Hello? Hello-hello?... The new guard? This is RULO, from the last shift.",
        "Listen close, rookie: the animatronics WANDER at night. Something in their servos... don't ask.",
        "Your FLASHLIGHT is with you — press F. It never runs out. Batteries are the least of your problems tonight.",
        "First job: the grid is tripping. Reset BOTH breakers in the ELECTRICAL ROOM, east side of the north halls.",
        "Then do my patrol: the WEST STORAGE annex west of the atrium, and the ARCADE. Something has been moving boxes around.",
        "Freddy is slow tonight. He won't be tomorrow. Crouch with Ctrl, stay quiet, and don't shine your light at him for too long.",
        "Finish the round, walk back to the office, and we'll talk tomorrow. A hundred and twenty dollars a week. Some paycheck, huh?",
    ]},
    objectives=[
        {'id': 'c1_b1', 'title': 'Reset breaker I — Electrical Room', 'hint': 'East of the north halls [hold E]', 'type': 'interact', 'room': 'electrical', 'target': 'breaker_1'},
        {'id': 'c1_b2', 'title': 'Reset breaker II — Electrical Room', 'hint': 'Next to breaker I [hold E]', 'type': 'interact', 'room': 'electrical', 'target': 'breaker_2'},
        {'id': 'c1_storage', 'title': 'Patrol the WEST STORAGE annex', 'hint': 'West of the atrium, past the security gates', 'type': 'goto', 'room': 'daycare'},
        {'id': 'c1_arcade', 'title': "Check the noise in the FAZER BLAST arcade", 'hint': 'North-west arcade hall', 'type': 'goto', 'room': 'arcade'},
        {'id': 'c1_office', 'title': 'Return alive to the Security Office', 'hint': 'South-west office — end of the round', 'type': 'system', 'target': 'office_returned'},
    ])

# ---- CAP 2: Bonnie Bowl — tablet, tokens, fuses, trial, prize ----
set_chapter(2,
    lines=[
        'The patrol is behind you. The whole MEGAPLEX is still dark.',
        'The bowling alley has its pinsetters fried.',
        'And the rabbit from the arcade has learned to use the vents.',
    ],
    radio={'atMinute': 0.3, 'lines': [
        "Still alive? Good. Listen: in the SECURITY OFFICE I left a tablet with the cameras. With it, you'll see them coming. Take it.",
        "Before anything else: grab TWO spare fuses — one in PARTS & SERVICE, one in NORTH STORAGE. The alley drinks power like a beast.",
        "Then collect 3 golden tokens from the arcade. You'll need them for the machines.",
        "The bowling alley has three fried pinsetters. Three. The boss wants the alley alive for tomorrow's event.",
        "And yes: it's a TRIAL. The lights will die, and she will come for you. If she catches you, you wake up on the promenade. Try again.",
        "Bonnie — the rabbit — comes out of the Arcade Hall. The flashlight freezes her if you hit her straight in the face.",
        "When the lanes sing again, swing by the PRIZE COUNTER. Something left a gift there.",
    ]},
    objectives=[
        {'id': 'c2_tablet', 'title': 'Pick up the surveillance tablet', 'hint': 'Security Office — your desk [C]', 'type': 'interact', 'room': 'office', 'target': 'desk_tablet'},
        {'id': 'c2_fuses', 'title': 'Find 2 spare fuses', 'hint': 'Parts & Service + North Storage', 'type': 'collect', 'count': 2},
        {'id': 'c2_tokens', 'title': 'Collect 3 golden tokens', 'hint': 'Scattered around the Arcade Hall', 'type': 'collect', 'count': 3},
        {'id': 'c2_trial', 'title': 'CLEAR THE TRIAL: Bowling Alley', 'hint': 'Enter the alley and restart the 3 pinsetters', 'type': 'trial', 'target': 'bowling'},
        {'id': 'c2_prize', 'title': 'Check the PRIZE COUNTER', 'hint': 'North-east, next to the arcade', 'type': 'goto', 'room': 'prize'},
    ])

# ---- CAP 3: Food Court ----
set_chapter(3,
    lines=[
        'The bowling alley sings. The night goes on.',
        'The Food Court must open tomorrow with all three stands running.',
        'The chicken is already circling the tables. And she can smell the oven.',
    ],
    radio={'atMinute': 0.3, 'lines': [
        "Chica — the chicken — has been hunting in the Food Court since tonight. Burnt pizza and feathers come before her.",
        "Start in the INDUSTRIAL KITCHEN. If the pots are clanging, she's close. Very close.",
        "Three fried stands: PIZZA, FRIES and ICE CREAM. Restart all three. The service notes say they reboot on their own... mostly.",
        "Chica does not dodge the flashlight. She hears EVERYTHING. Crouch with Ctrl and never run in there.",
        "When you're done, swing by Pirate's Cove. Someone left a sign there... and something moves behind the curtain.",
    ]},
    objectives=[
        {'id': 'c3_kitchen', 'title': 'Inspect the INDUSTRIAL KITCHEN', 'hint': 'North-west service wing — listen for the pots', 'type': 'goto', 'room': 'kitchen'},
        {'id': 'c3_trial', 'title': 'CLEAR THE TRIAL: Food Court', 'hint': 'Restart the 3 food stands', 'type': 'trial', 'target': 'foodcourt'},
        {'id': 'c3_cove', 'title': "Investigate Pirate's Cove", 'hint': "West end of the West Promenade", 'type': 'goto', 'room': 'pirateCove'},
    ])

# ---- CAP 4: Pirate's Cove ----
set_chapter(4,
    lines=[
        "The Cove attraction has been shut down for years.",
        "The fox behind the curtain has started to really run.",
        "Find the ship's tape. Flip the 3 switches. And never stop moving.",
    ],
    radio={'atMinute': 0.25, 'lines': [
        "Foxy. The fox. He's the fastest, and the only one the mask can't fool. If he chases you: sprint and weave.",
        "The flashlight REPELS him — straight in the face, no mercy, until he backs off.",
        "There's an old TAPE hidden by the pirate ship. Recover it — I need to know what's on it.",
        "Three switches on the south wall of the Cove, in order. If he catches you, you respawn on the promenade. His favorite game: cat and fox.",
        "When the attraction roars, check ROCKSTAR ROW. The guitars are playing by themselves again.",
    ]},
    objectives=[
        {'id': 'c4_tape', 'title': "Recover the ship's tape", 'hint': 'Near the pirate ship in the Cove', 'type': 'collect', 'count': 1},
        {'id': 'c4_trial', 'title': "CLEAR THE TRIAL: Pirate's Cove", 'hint': '3 attraction switches, in order', 'type': 'trial', 'target': 'cove'},
        {'id': 'c4_rockstar', 'title': 'Check ROCKSTAR ROW', 'hint': 'West gallery — the display rooms', 'type': 'goto', 'room': 'rockstar'},
    ])

# ---- CAP 5: Generators ----
set_chapter(5,
    lines=[
        'The master fuse is blown. The whole grid depends on it.',
        "The complex's power will be decided in the Generator Room.",
        'Order 3 · 1 · 4 · 2. And everyone wide awake.',
    ],
    radio={'atMinute': 0.2, 'lines': [
        "The note I left in the ELECTRICAL ROOM says it: 3, 1, 4, 2. The master fuse order for the Generator Room. Read it with your own eyes.",
        "The generator door is east of the South Promenade. I unlocked it for you. Don't ask how.",
        "One more thing: there's a GOLDEN SUIT in the South Technical Room, right under your office. If you feel it watching you... run. Don't fight. RUN.",
        "When the grid comes back, the lobby's outer doors will unlock. Run south. Don't look back.",
    ]},
    objectives=[
        {'id': 'c5_electrical', 'title': 'Read the fuse order — ELECTRICAL ROOM', 'hint': 'The note nailed to the panel', 'type': 'goto', 'room': 'electrical'},
        {'id': 'c5_trial', 'title': 'CLEAR THE TRIAL: Generators (3·1·4·2)', 'hint': 'Generator Room, master panel', 'type': 'trial', 'target': 'generators'},
        {'id': 'c5_techS', 'title': 'Investigate the SOUTH TECHNICAL ROOM', 'hint': 'Below the office — the golden suit', 'type': 'goto', 'room': 'techS'},
    ])

# ---- CAP 6: Hallway of Sounds (unchanged shape, tweak radio) ----
set_chapter(6,
    radio={'atMinute': 0.18, 'lines': [
        "*click* Still there? It's Rulo. The technical gallery just went dark.",
        "Six service doors, and only ONE way to know what's behind them: SOUND.",
        "A FAN hums where nobody is. POTS AND PANS clang where Chica is tearing the kitchen apart.",
        "If you hear heavy footsteps or a metallic laugh... NOT that door. Don't open it. Ever.",
        "I'll walk you through round by round. Listen before you move. Trust your ears, not your eyes.",
    ]})

# ---- CAP 7: THE BURNING BASEMENT — keycards, 5 extinguishers, escape ----
set_chapter(7,
    aggression=1.75, eventRate=1.15, startPower=70,
    lines=[
        'The night has already piled five trials on your back.',
        'And now the MEGAPLEX smells of burnt plastic.',
        'Below your feet, the ORIGINAL pizzeria is still burning. And MOON is singing in the flames.',
    ],
    radio={'atMinute': 0.2, 'lines': [
        "*click* …Rulo. You found the elevator shaft. THE BASEMENT. What's left of the ORIGINAL pizzeria.",
        "The fire doors need THREE keycards: ROCKSTAR ROW, the THEATER, and the FOOD COURT. Get them. All of them.",
        "It's been burning for YEARS down there. Racks, crates, spare parts, the old show stage... a graveyard with shelves.",
        "Something with a moon for a face lives in that smoke. It hears EVERYTHING. FIVE fires, FIVE extinguishers. Kill them all.",
        "When the SUN rises in the steam... RUN TO THE LOBBY EXIT. Don't look back.",
        "Whatever you were before tonight... it ends HERE.",
    ]},
    objectives=[
        {'id': 'c7_key1', 'title': 'Keycard — ROCKSTAR ROW', 'hint': 'West gallery display', 'type': 'interact', 'room': 'rockstar', 'target': 'key_rockstar'},
        {'id': 'c7_key2', 'title': 'Keycard — BRUNO THEATER', 'hint': 'Theater corridor', 'type': 'interact', 'room': 'theater', 'target': 'key_theater'},
        {'id': 'c7_key3', 'title': 'Keycard — FOOD COURT', 'hint': 'Among the tables', 'type': 'interact', 'room': 'foodcourt', 'target': 'key_foodcourt'},
        {'id': 'c7_descend', 'title': 'Descend into THE BURNING BASEMENT', 'hint': 'Fire doors: Parts & Service, Kitchen, North Storage', 'type': 'goto', 'room': 'megadaycare'},
        {'id': 'c7_trial', 'title': 'KILL THE INFERNO: 5 extinguishers', 'hint': 'The Basement — 5 fires, not one less', 'type': 'trial', 'target': 'sunmoon'},
        {'id': 'c7_escape', 'type': 'goto', 'label': 'RUN to the lobby EXIT', 'room': 'lobby'},
    ])
save('chapters.json', ch)

print('\nAll data files patched.')
