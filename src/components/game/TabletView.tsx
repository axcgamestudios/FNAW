'use client';

/**
 * Vista de la tableta de vigilancia: overlay CRT sobre el render de
 la cámara activa y mapa con selección de cámaras.
 */
import { useMemo } from 'react';
import mapData from '@/data/map.json';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

const CAM_NAMES: Record<number, string> = {
  1: 'ATRIO NORTE', 2: 'ATRIO SUR', 3: 'PASEO OESTE', 4: 'PASEO ESTE', 5: 'PASEO SUR',
  6: 'PASILLO TÉCNICO', 7: 'RECREATIVO', 8: 'COCINA', 9: 'BOLERA', 10: 'GUARDERÍA',
  11: 'CALA PIRATA', 12: 'GALERÍA', 13: 'TEATRO', 14: 'VESTÍBULO',
};

export default function TabletView() {
  const tabletOpen = useHud((s) => s.tabletOpen);
  const tabletCam = useHud((s) => s.tabletCam);
  const glitch = useHud((s) => s.tabletGlitch);

  const cams = mapData.cams;
  const current = cams.find((c) => c.index === tabletCam);
  const audioOnly = !!current?.audioOnly;

  const camButtons = useMemo(
    () => cams.map((c) => ({ index: c.index })),
    [cams]
  );

  if (!tabletOpen) return null;

  const game = getGame();
  const rooms = mapData.rooms;

  return (
    <div className="absolute inset-0 z-20">
      <div className="tablet-frame scanlines">
        <div className="absolute inset-0 tablet-static" style={{ opacity: glitch ? 0.65 : 0.25 }} />
        {glitch && <div className="tablet-glitch-line" />}
        <div className="crt-vignette" />

        {audioOnly && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#040705]">
            <p className="cam-label" style={{ color: '#7dcf8a' }}>SEÑAL DE VÍDEO PERDIDA</p>
            <div className="flex items-end gap-1 h-12 mt-6">
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-[#2d8a42]"
                  style={{
                    height: `${18 + Math.abs(Math.sin(i * 1.7 + performance.now() / 300)) * 60}%`,
                    animation: `tv-jitter 0.3s steps(2) ${i * 60}ms infinite`,
                  }}
                />
              ))}
            </div>
            <p className="cam-sub mt-6">SOLO AUDIO DISPONIBLE — CAM 08</p>
          </div>
        )}

        <div className="absolute top-3 left-5 flex items-center gap-3 z-10">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff2222]" style={{ animation: 'danger-pulse 1.2s infinite' }} />
          <span className="cam-label">
            CAM {String(tabletCam).padStart(2, '0')} — {CAM_NAMES[tabletCam] ?? ''}
          </span>
        </div>
        <div className="absolute top-9 left-5 z-10 cam-sub">
          REC ● 12-11-1987 · TURNO NOCTURNO · SEGURIDAD
        </div>

        {/* mapa y selector de cámaras */}
        <div className="absolute bottom-3 right-3 z-10">
          <svg width={230 * 1.55} height={170 * 1.4} viewBox="-45.5 -35.5 91 71" className="bg-[rgba(4,10,6,0.9)] border border-[#2a6636]">
            {rooms.map((r) => {
              const [x1, z1, x2, z2] = r.rect;
              return (
                <rect
                  key={r.id}
                  x={x1}
                  y={z1}
                  width={x2 - x1}
                  height={z2 - z1}
                  fill="rgba(20,50,28,0.35)"
                  stroke="#2a6636"
                  strokeWidth="0.18"
                />
              );
            })}
            {cams.map((c) => {
              const active = c.index === tabletCam;
              return (
                <g key={c.index} className="cursor-pointer" onClick={() => game?.cams.setCam(c.index)}>
                  <rect
                    x={c.pos[0] - 0.9}
                    y={c.pos[2] - 0.7}
                    width="1.8"
                    height="1.4"
                    fill={active ? '#2d8a42' : 'rgba(30,60,36,0.9)'}
                    stroke={active ? '#7dcf8a' : '#2a6636'}
                    strokeWidth="0.15"
                  />
                  <text x={c.pos[0]} y={c.pos[2] + 0.35} fontSize="0.9" textAnchor="middle" fill={active ? '#eafff0' : '#7dcf8a'}>
                    {c.index}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {camButtons.map((c) => (
              <button
                key={c.index}
                className={`cam-btn ${c.index === tabletCam ? 'active' : ''}`}
                onClick={() => game?.cams.setCam(c.index)}
              >
                {String(c.index).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute bottom-3 left-5 z-10 cam-sub">
          [C] CERRAR · [A/D] CAMBIAR CÁMARA · [1-9] RÁPIDA · 14 CÁMARAS
        </div>
      </div>

      {glitch && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-[#ff5544] text-xs tracking-[0.4em] z-30">
          ⚠ INTERFERENCIA EN LA SEÑAL — ALGO SE MUEVE AQUÍ
        </div>
      )}
    </div>
  );
}
