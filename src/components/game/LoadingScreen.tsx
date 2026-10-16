'use client';

/**
 * Pantalla de carga FNAW MEGAPLEX: estática CRT, título grunge con glitch,
 * barra segmentada roja, porcentaje y consejos reales del juego.
 */
import { useHud } from '@/game/core/state';

const TIPS = [
  'La bolera de Bruno es su territorio. Si las luces se funden, no estás solo en el carril.',
  'En la guardería nunca apagues la linterna: los ojos amarillos siguen el haz.',
  'El telón de la Cala del Pirata se mueve solo. Cuenta las veces. Tres es mal número.',
  'Los generadores arrancan en orden 3 · 1 · 4 · 2. Dorado despierta al tercero.',
  'Correr hace ruido. El ruido los atrae. A veces es mejor quedarse quieto.',
  'Si te atrapan durante una prueba, reapareces: las tareas se reinician, el miedo no.',
  'Las luces rojas de emergencia marcan el camino cuando todo lo demás muere.',
  'Necesitas 3 tarjetas para abrir la puerta sur. La galería, el teatro y la plaza guardan una cada uno.',
  'La tableta gasta energía, pero ver a Bonnie en el recreativo vale la pena.',
  'El estrobo del pasillo técnico parpadea antes de fallar. Ten un plan B.',
];

export default function LoadingScreen({ error }: { error: string | null }) {
  const progress = useHud((s) => s.loadingProgress);
  const label = useHud((s) => s.loadingLabel);
  const tip = TIPS[(Math.floor(progress * TIPS.length)) % TIPS.length];
  const pct = Math.round(progress * 100);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020203] scanlines">
      <div className="noise-bg" style={{ opacity: 0.12 }} />
      <div className="crt-vignette" />
      <div className="menu-crt-bars" />

      <h1 className="fnaw-title title-flicker">FNAW</h1>
      <div className="fnaw-sub">MEGAPLEX</div>
      <p className="mt-3 mb-10 text-[9px] tracking-[0.4em] fnaf-dim">COMPLEJO BRUNO — CARGANDO INSTALACIONES</p>

      {error ? (
        <div className="text-center max-w-md z-10">
          <p className="text-[#ff6a4a] mb-4">Error al iniciar el motor 3D: {error}</p>
          <p className="text-sm text-[#8a8578]">
            Tu navegador puede no soportar WebGL. Prueba con Chrome, Edge o Firefox actualizados
            y con la aceleración de hardware activada.
          </p>
          <button
            className="big-btn mt-8"
            onClick={() => window.location.reload()}
          >
            REINTENTAR
          </button>
        </div>
      ) : (
        <div className="z-10 flex flex-col items-center">
          <div className="load-bar">
            <div className="load-fill" style={{ width: `${pct}%` }} />
            <div className="load-ticks" />
          </div>
          <p className="load-pct">{pct}%</p>
          <p className="mt-2 text-xs tracking-[0.22em] text-[#b8b2a4]">{label}</p>
          <p className="mt-10 max-w-md text-center text-xs leading-relaxed text-[#6a655a] italic">
            «{tip}»
          </p>
        </div>
      )}
    </div>
  );
}
