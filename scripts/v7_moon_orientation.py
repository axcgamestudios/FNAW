#!/usr/bin/env python3
"""Proyecta los vértices de moon.glb para ver la silueta tras preRotX -90°.
Render frente (mirando -Z mundo = hacia el espectador) y perfil.
Sirve para confirmar hacia dónde mira la cara y si está de pie."""
import struct, json, math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

f = open('/home/z/my-project/public/models/moon.glb', 'rb')
magic, ver, length = struct.unpack('<III', f.read(12))
clen, ctype = struct.unpack('<II', f.read(8))
gltf = json.loads(f.read(clen).decode())

# buffer binario
blen, btype = struct.unpack('<II', f.read(8))
BIN = f.read(blen)

accs = gltf['accessors']
bvs = gltf['bufferViews']

def read_acc(idx):
    a = accs[idx]
    bv = bvs[a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    comp = a.get('componentType', 5126)  # 5126 float
    count = a['count']
    nc = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[a['type']]
    step = 4 if comp == 5126 else 2
    out = []
    for i in range(count):
        vals = struct.unpack_from('<' + 'f' * nc, BIN, off + i * nc * step)
        out.append(vals)
    return out

def node_matrix(n):
    if 'matrix' in n:
        m = n['matrix']
        # glTF es COLUMN-MAJOR: M[fila][col] = m[col*4 + fila]
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    t = n.get('translation', [0, 0, 0])
    q = n.get('rotation', [0, 0, 0, 1])
    s = n.get('scale', [1, 1, 1])
    # quaternion -> matrix
    x, y, z, w = q
    M = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), t[0]],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), t[1]],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), t[2]],
        [0, 0, 0, 1],
    ]
    for r in range(3):
        for c in range(3):
            M[r][c] *= s[c]
    return M

def mat_mul(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

def apply(M, p):
    x, y, z = p
    return (
        M[0][0] * x + M[0][1] * y + M[0][2] * z + M[0][3],
        M[1][0] * x + M[1][1] * y + M[1][2] * z + M[1][3],
        M[2][0] * x + M[2][1] * y + M[2][2] * z + M[2][3],
    )

nodes = gltf['nodes']

def collect(nidx, parentM, pts):
    n = nodes[nidx]
    M = mat_mul(parentM, node_matrix(n))
    if 'mesh' in n:
        mesh = gltf['meshes'][n['mesh']]
        for prim in mesh.get('primitives', []):
            pa = prim['attributes']['POSITION']
            decim = max(1, accs[pa]['count'] // 900)
            for i, p in enumerate(read_acc(pa)):
                if i % decim == 0:
                    pts.append(apply(M, p))
    for c in n.get('children', []):
        collect(c, M, pts)

pts = []
for root in gltf['scenes'][0]['nodes']:
    collect(root, [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]], pts)
print('vértices:', len(pts))

# preRotX -90°: (y,z) -> (z, -y)
rot = [(x, z, -y) for (x, y, z) in pts]

fig, axes = plt.subplots(1, 3, figsize=(15, 6))
# FRENTE: mirando desde -Z hacia +Z (el espectador ve el frente del modelo)
axes[0].scatter([p[0] for p in rot], [p[1] for p in rot], s=0.35, c='k')
axes[0].set_title('FRENTE (vista desde -Z, X vs Y)')
axes[0].set_aspect('equal')
# PERFIL: mirando desde +X
axes[1].scatter([p[2] for p in rot], [p[1] for p in rot], s=0.35, c='k')
axes[1].set_title('PERFIL (vista desde +X, Z vs Y)')
axes[1].set_aspect('equal')
# PLANTA: desde arriba
axes[2].scatter([p[0] for p in rot], [p[2] for p in rot], s=0.35, c='k')
axes[2].set_title('PLANTA (desde +Y, X vs Z)')
axes[2].set_aspect('equal')
for ax in axes:
    ax.axhline(0, color='r', lw=0.4)
    ax.axvline(0, color='b', lw=0.4)
plt.tight_layout()
plt.savefig('/home/z/my-project/scripts/v7_moon_silhouette.png', dpi=110)
print('guardado scripts/v7_moon_silhouette.png')
