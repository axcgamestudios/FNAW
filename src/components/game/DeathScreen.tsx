'use client';

/**
 * Pantalla de muerte: estática, culpable y opciones.
 */
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

const DEATH_TIPS: Record<string, string> = {
  bruno: 'Bruno patrulla el pasillo principal. Si lo oyes gemir, aléjate o ponte la máscara a tiempo.',
  clara: 'Clara usa los conductos. Revisa las rejillas y mantenla iluminada para congelarla.',
  gina: 'Gina acude a los ruidos de la cocina. Camina agachado y no corras cerca de ella.',
  ren: 'A Ren no lo engaña la máscara. Apunta la linterna directamente a sus ojos para ahuyentarlo.',
  puppet: 'La marioneta no se detiene. Solo la melodía de la caja musical la mantiene dormida.',
};

export default function DeathScreen() {
  const deadBy = useHud((s) => s.deadBy);
  const night = useHud((s) => s.night);
  const game = getGame();
  const key = deadBy?.toLowerCase().includes('bruno') ? 'bruno'
    : deadBy?.toLowerCase().includes('clara') ? 'clara'
    : deadBy?.toLowerCase().includes('gina') ? 'gina'
    : deadBy?.toLowerCase().includes('ren') ? 'ren'
    : deadBy?.toLowerCase().includes('marioneta') ? 'puppet' : 'bruno';

  const retry = () => {
    game?.retryNight();
    useHud.getState().setMode('playing');
    const canvas = document.querySelector('.game-canvas') as HTMLCanvasElement | null;
    canvas?.requestPointerLock?.();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'rgba(3,2,2,0.96)' }}>
      <div className="noise-bg" style={{ opacity: 0.22 }} />
      <div className="scanlines absolute inset-0 pointer-events-none" />

      <p className="text-[10px] tracking-[0.6em] text-[#5a564c] mb-4">NOCHE {String(night).padStart(2, '0')} — 12 AM A 6 AM</p>
      <h2 className="text-5xl tracking-[0.3em] text-[#c83428] mb-4" style={{ textShadow: '0 0 30px rgba(200,52,40,0.5)' }}>
        TE ENCONTRARON
      </h2>
      <p className="text-sm text-[#8a8578] tracking-[0.25em] mb-10">{deadBy ?? 'ALGO'} TE ALCANZÓ EN LA OSCURIDAD</p>

      <div className="max-w-md text-center mb-12 px-6">
        <p className="text-xs leading-6 text-[#6a655a] italic">«{DEATH_TIPS[key]}»</p>
      </div>

      <div className="flex gap-6">
        <button className="big-btn" onClick={retry}>REINTENTAR NOCHE</button>
        <button className="big-btn" onClick={() => getGame()?.returnToMenu()}>SALIR AL MENÚ</button>
      </div>
    </div>
  );
}
