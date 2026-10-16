'use client';

/**
 * Pantalla de capítulo completado.
 */
import chaptersData from '@/data/chapters.json';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

export default function ChapterCompleteScreen() {
  const chapter = useHud((s) => s.chapter);
  const objectives = useHud((s) => s.objectives);
  const tapes = useHud((s) => s.tapes);
  const unlockedChapter = useHud((s) => s.unlockedChapter);
  const game = getGame();
  const doneCount = objectives.filter((o) => o.done).length;
  const hasNext = chapter < 4 && unlockedChapter > chapter;

  const nextChapter = () => {
    const next = chapter + 1;
    const def = (chaptersData as { chapters: Array<{ chapter: number; title: string; lines: string[] }> }).chapters.find((n) => n.chapter === next);
    if (!def) return;
    game?.returnToMenu();
    useHud.getState().setIntro(def.lines);
    useHud.getState().syncHud({ chapter: next, chapterTitle: def.title });
    useHud.getState().setMode('intro');
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 45%, #101018 0%, #020203 75%)' }}>
      <div className="scanlines absolute inset-0 pointer-events-none" />
      <p className="text-[10px] tracking-[0.6em] text-[#5a564c] mb-4">CAPÍTULO {String(chapter).padStart(2, '0')} SUPERADO</p>
      <h2 className="text-4xl font-bold tracking-[0.2em] text-[#d8c8a0] mb-10" style={{ textShadow: '0 0 40px rgba(216,177,58,0.4)' }}>
        AMANECE
      </h2>

      <div className="mb-10 text-center">
        <p className="text-[11px] tracking-[0.3em] text-[#8a8578] mb-2">
          OBJETIVOS COMPLETADOS: {doneCount}/{objectives.length}
        </p>
        <p className="text-[11px] tracking-[0.3em] text-[#8a8578]">
          CINTAS RECUPERADAS EN TOTAL: {tapes.length}/11
        </p>
      </div>

      <div className="flex gap-6">
        {hasNext && <button className="big-btn" onClick={nextChapter}>CAPÍTULO SIGUIENTE</button>}
        <button className="big-btn" onClick={() => getGame()?.returnToMenu()}>MENÚ PRINCIPAL</button>
      </div>

      <p className="mt-10 text-[10px] text-[#4a4640] tracking-[0.2em]">El turno de día empieza. Los niños llegan a las 10.</p>
    </div>
  );
}
