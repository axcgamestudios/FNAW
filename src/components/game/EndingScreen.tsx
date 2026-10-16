'use client';

/**
 * Pantalla de final (escape de la noche 5): final normal o secreto.
 */
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

export default function EndingScreen() {
  const ending = useHud((s) => s.ending);
  const lines = useHud((s) => s.endingLines);
  const tapes = useHud((s) => s.tapes);

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center scanlines"
      style={{
        background:
          ending === 'secret'
            ? 'radial-gradient(ellipse at 50% 40%, #181420 0%, #020203 75%)'
            : 'radial-gradient(ellipse at 50% 40%, #101018 0%, #020203 75%)',
      }}
    >
      <p
        className={`text-3xl tracking-[0.4em] mb-10 ${ending === 'secret' ? 'text-[#d8b13a]' : 'text-[#d8c8a0]'}`}
        style={{ textShadow: '0 0 30px rgba(216,177,58,0.35)' }}
      >
        {ending === 'secret' ? 'LA ÚLTIMA CUERDA' : 'AMANECER'}
      </p>

      <div className="max-w-xl px-8 space-y-4 mb-12">
        {lines.map((l, i) => (
          <p
            key={i}
            className="intro-line text-sm leading-7 text-[#9a9488]"
            style={{ animationDelay: `${i * 0.5}s` }}
          >
            {l}
          </p>
        ))}
      </div>

      <p className="text-[10px] tracking-[0.3em] text-[#5a564c] mb-8">
        CINTAS RECUPERADAS: {tapes.length}/10 {tapes.length < 10 ? '— HAY OTRO FINAL...' : ''}
      </p>

      <button className="big-btn" onClick={() => getGame()?.returnToMenu()}>
        VOLVER AL MENÚ
      </button>
    </div>
  );
}
