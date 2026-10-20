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
  const night = useHud((s) => s.chapter);
  const chapterTitle = useHud((s) => s.chapterTitle);

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
    game.retryChapter();
    if (game.mode !== 'cinematic') {
      useHud.getState().setMode('playing');
    } else {
      useHud.getState().setMode('cinematic');
    }
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
          <p className="text-[10px] tracking-[0.5em] text-[#5a564c] mb-1">PAUSED — MISSION {String(night).padStart(2, '0')} / 08 · {chapterTitle.toUpperCase()}</p>
          <h2 className="text-2xl tracking-[0.3em] text-[#c9c2b0] mb-8">SHIFT ON HOLD</h2>
          <button className="menu-btn" onClick={resume}>RESUME</button>
          <button className="menu-btn" onClick={restart}>RESPAWN (KEEPS PROGRESS)</button>
          <button className="menu-btn" onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')}>SETTINGS</button>
          <button className="menu-btn" onClick={() => setPanel(panel === 'controls' ? 'none' : 'controls')}>CONTROLS</button>
          <button className="menu-btn" onClick={quit}>EXIT TO MENU</button>
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
            <p className="text-[#c9c2b0] tracking-[0.25em] mb-3">CONTROLS</p>
            <div className="grid grid-cols-[110px_1fr] gap-y-1">
              <span className="text-[#d8b13a]">W A S D</span><span>Move</span>
              <span className="text-[#d8b13a]">MOUSE</span><span>Look</span>
              <span className="text-[#d8b13a]">SHIFT</span><span>Sprint</span>
              <span className="text-[#d8b13a]">CTRL</span><span>Crouch</span>
              <span className="text-[#d8b13a]">E</span><span>Interact / repair</span>
              <span className="text-[#d8b13a]">F</span><span>Flashlight</span>
              <span className="text-[#d8b13a]">Q</span><span>Mask</span>
              <span className="text-[#d8b13a]">C</span><span>Cameras</span>
              <span className="text-[#d8b13a]">CAM 17</span><span>Watch the MUSIC BOX to wind it (office night)</span>
            </div>
            <p className="mt-4 text-[10px] text-[#5a564c]">
              The game is fully paused: enemies, timers and audio.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
