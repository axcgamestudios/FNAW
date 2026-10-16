'use client';

/**
 * Vista de la tableta de vigilancia: overlay CRT sobre el render de
 la cámara activa, mapa con selección de cámaras y cuerda de la caja musical.
 */
import { useMemo } from 'react';
import mapData from '@/data/map.json';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

const CAM_NAMES: Record<number, string> = {
  1: 'ESCENARIO', 2: 'COMEDOR', 3: 'P. PRINCIPAL', 4: 'PREMIOS', 5: 'SALA JUEGOS',
  6: 'R. INFANTIL', 7: 'TALLER', 8: 'COCINA', 9: 'P. OESTE', 10: 'P. ESTE',
  11: 'ELÉCTRICO', 12: 'VESTÍBULO',
};

export default function TabletView() {
  const tabletOpen = useHud((s) => s.tabletOpen);
  const tabletCam = useHud((s) => s.tabletCam);
  const glitch = useHud((s) => s.tabletGlitch);
  const musicBox = useHud((s) => s.musicBox);
  const musicBoxCam = useHud((s) => s.musicBoxCam);

  const cams = mapData.cams;
  const current = cams.find((c) => c.index === tabletCam);
  const audioOnly = !!current?.audioOnly;

  const camButtons = useMemo(
    () =>
      cams.map((c) => ({
        index: c.index,
        name: CAM_NAMES[c.index] ?? `CAM ${c.index}`,
        room: c.room,
        broken: false,
      })),
    [cams]
  );

  if (!tabletOpen) return null;

  const game = getGame();
  const rooms = mapData.rooms;

  return (
    <div className="absolute inset-0 z-20">
      {/* marco de la tableta */}
      <div className="tablet-frame scanlines">
        {/* pantalla con ruido */}
        <div className="absolute inset-0 tablet-static" style={{ opacity: glitch ? 0.65 : 0.25 }} />
        {glitch && <div className="tablet-glitch-line" />}
        <div className="crt-vignette" />

        {audioOnly && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#040705]">
            <p className="text-[#7dcf8a] text-sm tracking-[0.4em] mb-6">SEÑAL DE VÍDEO PERDIDA</p>
            <div className="flex items-end gap-1 h-12">
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
            <p className="mt-6 text-[10px] tracking-[0.3em] text-[#4a8a55]">SOLO AUDIO DISPONIBLE</p>
          </div>
        )}

        {/* cabecera */}
        <div className="absolute top-3 left-5 flex items-center gap-3 z-10">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff2222]" style={{ animation: 'danger-pulse 1.2s infinite' }} />
          <span className="text-[#7dcf8a] text-xs tracking-[0.25em]">
            CAM {String(tabletCam).padStart(2, '0')} — {CAM_NAMES[tabletCam] ?? ''}
          </span>
          <span className="text-[10px] text-[#4a8a55] tracking-[0.2em]">REC ● 1987-10-12</span>
        </div>

        {/* caja musical: control de cuerda */}
        {musicBoxCam && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center z-10">
            <p className={`text-xs tracking-[0.3em] mb-2 ${musicBox < 25 ? 'text-[#ff5544]' : 'text-[#d8b13a]'}`}>
              CAJA MUSICAL — {Math.round(musicBox)}%
            </p>
            <div className="w-64 mx-auto hud-bar mb-3">
              <div
                className="hud-bar-fill"
                style={{
                  width: `${musicBox}%`,
                  background: musicBox < 25 ? '#c83428' : '#d8b13a',
                }}
              />
            </div>
            <button
              className="px-8 py-3 text-sm tracking-[0.25em] border border-[#d8b13a] text-[#ffe9a0] bg-[rgba(60,40,8,0.75)] cursor-pointer hover:bg-[rgba(90,60,12,0.9)] active:bg-[#d8b13a] active:text-[#201400]"
              onMouseDown={() => game?.setMouseWinding(true)}
              onMouseUp={() => game?.setMouseWinding(false)}
              onMouseLeave={() => game?.setMouseWinding(false)}
              onTouchStart={() => game?.setMouseWinding(true)}
              onTouchEnd={() => game?.setMouseWinding(false)}
            >
              MANTÉN PARA DAR CUERDA
            </button>
            <p className="mt-2 text-[10px] text-[#8a8578] tracking-[0.2em]">[ESPACIO] también funciona</p>
          </div>
        )}

        {/* mapa y selector de cámaras */}
        <div className="absolute bottom-3 right-3 z-10">
          <svg width="230" height="170" viewBox="-25 -18.5 50 37" className="bg-[rgba(4,10,6,0.9)] border border-[#2a6636]">
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
            {/* posiciones de cámaras */}
            {cams.map((c) => {
              const active = c.index === tabletCam;
              return (
                <g
                  key={c.index}
                  className="cursor-pointer"
                  onClick={() => game?.cams.setCam(c.index)}
                >
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
          <div className="mt-2 grid grid-cols-4 gap-1">
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

        {/* pie: controles */}
        <div className="absolute bottom-3 left-5 z-10 text-[10px] tracking-[0.25em] text-[#4a8a55]">
          [C] CERRAR · [A/D] CAMBIAR CÁMARA · [1-9] SELECCIÓN RÁPIDA
        </div>
      </div>

      {/* alerta de interferencia */}
      {glitch && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-[#ff5544] text-xs tracking-[0.4em] z-30">
          ⚠ INTERFERENCIA EN LA SEÑAL — ALGO SE MUEVE AQUÍ
        </div>
      )}
    </div>
  );
}
