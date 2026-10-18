'use client';

/**
 * Intro de capítulo: líneas de apertura + botón de comenzar.
 */
import { useCallback, useEffect } from 'react';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

export default function ChapterIntro() {
  const lines = useHud((s) => s.introLines);
  const chapter = useHud((s) => s.chapter);
  const chapterTitle = useHud((s) => s.chapterTitle);
  const setMode = useHud((s) => s.setMode);

  const start = useCallback(() => {
    const game = getGame();
    if (!game) return;
    game.startChapter(chapter);
    game.audio.init();
    game.audio.resume();
    const canvas = document.querySelector('.game-canvas') as HTMLCanvasElement | null;
    canvas?.requestPointerLock?.();
    // el modo lo fija la cinemática de entrada o beginPlay
    if (game.mode !== 'cinematic') {
      setMode('playing');
    } else {
      setMode('cinematic');
    }
  }, [chapter, setMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020203] scanlines">
      <p className="text-xs tracking-[0.6em] text-[#5a564c] mb-6">CHAPTER {String(chapter).padStart(2, '0')}</p>
      <h2 className="text-3xl tracking-[0.3em] text-[#c9c2b0] mb-10 title-flicker">
        {chapterTitle.toUpperCase()}
      </h2>
      <div className="max-w-lg text-center space-y-3 mb-14 px-6">
        {lines.map((l, i) => (
          <p
            key={i}
            className="intro-line text-sm leading-relaxed text-[#8a8578]"
            style={{ animationDelay: `${i * 0.55}s` }}
          >
            {l}
          </p>
        ))}
      </div>
      <button className="big-btn" onClick={start}>
        BEGIN
      </button>
      <p className="mt-6 text-[10px] tracking-[0.3em] text-[#3a382f]">PRESS ENTER TO BEGIN</p>
    </div>
  );
}
