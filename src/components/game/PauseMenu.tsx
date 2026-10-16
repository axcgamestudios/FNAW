'use client';

/**
 * Menú de pausa: reanudar, ajustes, controles, reiniciar noche, salir.
 La simulación queda completamente detenida (el bucle no hace tick).
 */
import { useState } from 'react';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';
import { saveSettings } from '@/game/systems/save';
import SettingsPanel from './SettingsPanel';

export default function PauseMenu() {
  const [panel, setPanel] = useState<'none' | 'settings' | 'controls'>('none');
  const night = useHud((s) => s.night);

  const resume = () => {
    const game = getGame();
    if (!game) return;
    game.resume();
    const canvas = document.querySelector('.game-canvas') as HTMLCanvasElement | null;
    canvas?.requestPointerLock?.();
  };

  const restart = () => {
    const game = getGame();
    if (!game) return;
    game.retryNight();
    useHud.getState().setMode('playing');
    const canvas = document.querySelector('.game-canvas') as HTMLCanvasElement | null;
    canvas?.requestPointerLock?.();
  };

  const quit = () => {
    getGame()?.returnToMenu();
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(2,2,4,0.82)' }}>
      <div className="scanlines absolute inset-0 pointer-events-none" />
      <div className="flex gap-12 items-start">
        <div className="w-[300px]">
          <p className="text-[10px] tracking-[0.5em] text-[#5a564c] mb-1">PAUSA — NOCHE {String(night).padStart(2, '0')}</p>
          <h2 className="text-2xl tracking-[0.3em] text-[#c9c2b0] mb-8">TURNO DETENIDO</h2>
          <button className="menu-btn" onClick={resume}>REANUDAR</button>
          <button className="menu-btn" onClick={restart}>REINICIAR NOCHE</button>
          <button className="menu-btn" onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')}>AJUSTES</button>
          <button className="menu-btn" onClick={() => setPanel(panel === 'controls' ? 'none' : 'controls')}>CONTROLES</button>
          <button className="menu-btn" onClick={quit}>SALIR AL MENÚ</button>
        </div>

        {panel === 'settings' && (
          <div className="w-[360px]">
            <SettingsPanel onApply={() => {
              const s = useHud.getState().settings;
              saveSettings(s);
              getGame()?.applySettings();
            }} />
          </div>
        )}

        {panel === 'controls' && (
          <div className="w-[340px] text-[11px] leading-6 text-[#8a8578] bg-[rgba(8,8,10,0.85)] border border-[#2a2a2e] p-5">
            <p className="text-[#c9c2b0] tracking-[0.25em] mb-3">CONTROLES</p>
            <div className="grid grid-cols-[110px_1fr] gap-y-1">
              <span className="text-[#d8b13a]">W A S D</span><span>Moverse</span>
              <span className="text-[#d8b13a]">RATÓN</span><span>Mirar</span>
              <span className="text-[#d8b13a]">SHIFT</span><span>Correr</span>
              <span className="text-[#d8b13a]">CTRL</span><span>Agacharse</span>
              <span className="text-[#d8b13a]">E</span><span>Interactuar / reparar</span>
              <span className="text-[#d8b13a]">F</span><span>Linterna</span>
              <span className="text-[#d8b13a]">Q</span><span>Máscara</span>
              <span className="text-[#d8b13a]">C</span><span>Cámaras</span>
              <span className="text-[#d8b13a]">ESPACIO</span><span>Dar cuerda (CAM 04)</span>
            </div>
            <p className="mt-4 text-[10px] text-[#5a564c]">
              El juego está completamente pausado: enemigos, temporizadores y audio.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
