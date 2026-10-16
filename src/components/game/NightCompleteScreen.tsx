'use client';

/**
 * Pantalla de noche completada (6 AM).
 */
import nightsData from '@/data/nights.json';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

export default function NightCompleteScreen() {
  const night = useHud((s) => s.night);
  const objectives = useHud((s) => s.objectives);
  const tapes = useHud((s) => s.tapes);
  const unlockedNight = useHud((s) => s.unlockedNight);
  const game = getGame();
  const doneCount = objectives.filter((o) => o.done).length;
  const hasNext = night < 5 && unlockedNight > night;

  const nextNight = () => {
    const next = night + 1;
    const def = (nightsData as { nights: Array<{ night: number; title: string; intro: string[] }> }).nights.find((n) => n.night === next);
    if (!def) return;
    game?.returnToMenu();
    useHud.getState().setIntro(def.intro);
    useHud.getState().syncHud({ night: next, nightTitle: def.title });
    useHud.getState().setMode('intro');
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 45%, #101018 0%, #020203 75%)' }}>
      <div className="scanlines absolute inset-0 pointer-events-none" />
      <p className="text-6xl font-bold tracking-[0.2em] text-[#d8c8a0] mb-2" style={{ textShadow: '0 0 40px rgba(216,177,58,0.4)' }}>
        6 AM
      </p>
      <p className="text-xs tracking-[0.5em] text-[#6a655a] mb-10">NOCHE {String(night).padStart(2, '0')} SUPERADA</p>

      <div className="mb-10 text-center">
        <p className="text-[11px] tracking-[0.3em] text-[#8a8578] mb-2">
          OBJETIVOS COMPLETADOS: {doneCount}/{objectives.length}
        </p>
        <p className="text-[11px] tracking-[0.3em] text-[#8a8578]">
          CINTAS RECUPERADAS EN TOTAL: {tapes.length}/10
        </p>
        {night === 5 && (
          <p className="mt-6 text-xs tracking-[0.25em] text-[#d8b13a]">
            AMANECISTE DENTRO DEL EDIFICIO... Y SIGUES EMPLEADO.
          </p>
        )}
      </div>

      <div className="flex gap-6">
        {hasNext ? (
          <button className="big-btn" onClick={nextNight}>NOCHE SIGUIENTE</button>
        ) : night >= 5 ? (
          <button className="big-btn" onClick={() => getGame()?.returnToMenu()}>VOLVER AL MENÚ</button>
        ) : null}
        <button className="big-btn" onClick={() => getGame()?.returnToMenu()}>MENÚ PRINCIPAL</button>
      </div>

      <p className="mt-10 text-[10px] text-[#4a4640] tracking-[0.2em]">El turno de día empieza. Los niños llegan a las 10.</p>
    </div>
  );
}
