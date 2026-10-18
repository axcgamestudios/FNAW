'use client';

/**
 * Overlay de cinemáticas: barras de cine, texto de la toma y salto.
 */
import { useEffect } from 'react';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

export default function CinematicOverlay() {
  const active = useHud((s) => s.cinematic);
  const text = useHud((s) => s.cinematicText);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        getGame()?.skipCinematic();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* barras de cine */}
      <div className="absolute top-0 left-0 right-0 h-[11%]" style={{ background: '#000' }} />
      <div className="absolute bottom-0 left-0 right-0 h-[11%]" style={{ background: '#000' }} />

      {/* grano de película */}
      <div className="noise-bg" style={{ opacity: 0.08 }} />

      {/* texto de la toma */}
      {text && (
        <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 max-w-[70%] text-center">
          <p
            key={text}
            className="intro-line text-lg md:text-xl text-[#e8e2d0] leading-relaxed"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.95)' }}
          >
            {text}
          </p>
        </div>
      )}

      {/* salto */}
      <div
        className="absolute bottom-[3%] right-8 text-[10px] tracking-[0.3em] text-[#5a564c] pointer-events-auto cursor-pointer hover:text-[#b8b2a4]"
        onClick={() => getGame()?.skipCinematic()}
      >
        SKIP [E] · ESC TO SKIP ALL
      </div>
    </div>
  );
}
