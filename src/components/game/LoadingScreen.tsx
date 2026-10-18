'use client';

/**
 * Pantalla de carga FNAW MEGAPLEX: imagen real del repo (la pizzería en
 * llamas con Freddy quemado) bajo estática CRT, barra segmentada roja,
 * porcentaje y consejos reales del juego.
 */
import { useHud } from '@/game/core/state';

const TIPS = [
  "You're the new NIGHT GUARD: $120 a week. Your FLASHLIGHT is already on your belt — press F.",
  "The WEST STORAGE annex is full of shelves and boxes. Lately, they move on their own.",
  "The CENTRAL ATRIUM is the heart of the MEGAPLEX: Freddy's golden statue watches you from the south.",
  "Bruno's bowling alley is her territory. If the lights die, you're not alone on the lane.",
  "The curtain at Pirate's Cove moves on its own. Count the times. Three is a bad number.",
  "The master generators start in order 3 · 1 · 4 · 2. The Golden one wakes on the third.",
  "TECHNICAL GALLERY pitch black: listen for the FAN'S HUM and the POTS before opening a door.",
  "A metallic laugh behind a service door is not an invitation. Don't open it. Ever.",
  "THE BASEMENT holds the ORIGINAL pizzeria burning. Racks, crates, spare parts... and FIVE fires to kill.",
  "MOON only lives at the END, in the burning basement. It hears EVERYTHING. Crouch. Hold still.",
  "Three keycards — ROCKSTAR ROW, THEATER, FOOD COURT — open the fire doors to the basement.",
  "If you survive SUN AND MOON, the EXIT opens. Run to the lobby. Don't look back.",
  "Running makes noise. Noise draws them in. Sometimes it's better to hold still.",
  "If they catch you during a trial, you respawn: tasks reset, the fear doesn't.",
];

export default function LoadingScreen({ error }: { error: string | null }) {
  const progress = useHud((s) => s.loadingProgress);
  const label = useHud((s) => s.loadingLabel);
  const tip = TIPS[(Math.floor(progress * TIPS.length)) % TIPS.length];
  const pct = Math.round(progress * 100);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020203] scanlines overflow-hidden">
      {/* imagen de fondo real del repo (FNAF: NEW WORLD en llamas) */}
      <img src="/images/loading_bg.jpeg" alt="" className="menu-bg-img" draggable={false} />
      <div className="load-bg-shade" />
      <div className="noise-bg" style={{ opacity: 0.14 }} />
      <div className="crt-vignette" />
      <div className="menu-crt-bars" />

      <p className="mt-3 mb-10 text-[9px] tracking-[0.4em] fnaf-dim z-10">BRUNO COMPLEX — LOADING FACILITIES</p>

      {error ? (
        <div className="text-center max-w-md z-10">
          <p className="text-[#ff6a4a] mb-4">Error starting the 3D engine: {error}</p>
          <p className="text-sm text-[#8a8578]">
            Your browser may not support WebGL. Try an updated Chrome, Edge or Firefox
            with hardware acceleration enabled.
          </p>
          <button
            className="big-btn mt-8"
            onClick={() => window.location.reload()}
          >
            RETRY
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
