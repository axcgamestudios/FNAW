'use client';

/**
 * Pantalla de muerte: estática, culpable y opciones.
 */
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

const DEATH_TIPS: Record<string, string> = {
  freddy: 'Freddy patrols the main hall. If you hear him groan, back away or get your mask on in time.',
  bonnie: 'Bonnie uses the vents. Check the grilles and keep your light on her to freeze her in place.',
  chica: 'Chica runs toward kitchen noises. Crouch-walk and never run near her.',
  foxy: 'The mask doesn\'t fool Foxy. Point the flashlight straight at his eyes to drive him back.',
  golden: 'Golden Freddy never stops and can\'t be fooled. There is only one way out: run and never look back.',
};

export default function DeathScreen() {
  const deadBy = useHud((s) => s.deadBy);
  const chapter = useHud((s) => s.chapter);
  const game = getGame();
  const key = deadBy?.toLowerCase().includes('freddy') && deadBy?.toLowerCase().includes('golden') ? 'golden'
    : deadBy?.toLowerCase().includes('freddy') ? 'freddy'
    : deadBy?.toLowerCase().includes('bonnie') ? 'bonnie'
    : deadBy?.toLowerCase().includes('chica') ? 'chica'
    : deadBy?.toLowerCase().includes('foxy') ? 'foxy' : 'freddy';

  const retry = () => {
    game?.retryChapter();
    if (game && game.mode !== 'cinematic') {
      useHud.getState().setMode('playing');
    } else {
      useHud.getState().setMode('cinematic');
    }
    const canvas = document.querySelector('.game-canvas') as HTMLCanvasElement | null;
    canvas?.requestPointerLock?.();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden" style={{ background: 'rgba(3,2,2,0.82)' }}>
      {/* imagen real del repo: la pizzería en llamas y el Freddy quemado */}
      <img src="images/loading_bg.jpeg" alt="" className="menu-bg-img death-bg-img" draggable={false} />
      <div className="death-bg-shade" />
      <div className="noise-bg" style={{ opacity: 0.22 }} />
      <div className="scanlines absolute inset-0 pointer-events-none" />

      <p className="text-[10px] tracking-[0.6em] text-[#5a564c] mb-4 z-10">MISSION {String(chapter).padStart(2, '0')} / 08</p>
      <h2 className="text-5xl tracking-[0.3em] text-[#c83428] mb-4 z-10" style={{ textShadow: '0 0 30px rgba(200,52,40,0.5)' }}>
        THEY FOUND YOU
      </h2>
      <p className="text-sm text-[#8a8578] tracking-[0.25em] mb-10 z-10">{deadBy ?? 'SOMETHING'} CAUGHT YOU IN THE DARK</p>

      <div className="max-w-md text-center mb-12 px-6 z-10">
        <p className="text-xs leading-6 text-[#6a655a] italic">«{DEATH_TIPS[key]}»</p>
      </div>

      <div className="flex gap-6 z-10">
        <button className="big-btn death-btn" onClick={retry}>RESPAWN — KEEP PROGRESS</button>
        <button className="big-btn death-btn" onClick={() => getGame()?.returnToMenu()}>EXIT TO MENU</button>
      </div>
    </div>
  );
}
