'use client';

/**
 * Menú principal FNAW: imagen real del repo (salón con el Show Stage y los
 * animatrónicos) bajo estática CRT, opciones fantasma con marcador » y
 * paneles a la derecha. v14: UNA SOLA CAMPAÑA CONTINUA de 8 misiones.
 */
import { useState } from 'react';
import chaptersData from '@/data/chapters.json';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';
import { saveSettings, resetSave } from '@/game/systems/save';
import SettingsPanel from './SettingsPanel';

type Panel = 'none' | 'campaign' | 'settings' | 'controls' | 'credits';

const TOTAL_MISSIONS = 8;
const TOTAL_TAPES = 13;

export default function MainMenu() {
  const [panel, setPanel] = useState<Panel>('none');
  const unlockedChapter = useHud((s) => s.unlockedChapter);
  const tapes = useHud((s) => s.tapes);
  const setIntro = useHud((s) => s.setIntro);

  const chapters = (chaptersData as { chapters: Array<{ chapter: number; title: string; lines: string[] }> }).chapters;

  const launchChapter = (n: number, newspaper = false) => {
    const ch = chapters.find((x) => x.chapter === n);
    if (!ch) return;
    setIntro(ch.lines);
    useHud.getState().syncHud({ chapter: n, chapterTitle: ch.title });
    if (newspaper) {
      // NUEVA CAMPAÑA: periódico de apertura + intro de la misión 1
      useHud.getState().setMode('newspaper');
    } else if (n === 1) {
      useHud.getState().setMode('intro');
    } else {
      // v14 — CONTINUAR: directo al mundo, SIN pantallas de carga ni selección
      const game = getGame();
      if (game) game.startChapter(n);
    }
  };

  const progressChapter = Math.min(unlockedChapter, TOTAL_MISSIONS);

  return (
    <div className="absolute inset-0 scanlines overflow-hidden">
      {/* imagen de fondo real del repo (FNAF: NEW WORLD — salón + Show Stage) */}
      <img src="images/menu_bg.png" alt="" className="menu-bg-img" draggable={false} />
      <div className="menu-bg-shade" />

      {/* estática tenue */}
      <div className="noise-bg" style={{ opacity: 0.12 }} />
      <div className="crt-vignette" />
      {/* barras de seguimiento CRT */}
      <div className="menu-crt-bars" />

      {/* el título FNAF: NEW WORLD viene en la propia imagen; aquí solo el subtítulo */}
      <div className="absolute top-10 left-10 z-10">
        <div className="fnaw-sub title-flicker" style={{ fontSize: '1.05rem' }}>NEW WORLD</div>
        <p className="mt-4 text-[9px] tracking-[0.34em] fnaf-dim">
          BRUNO COMPLEX · CLOSING SHIFT
        </p>
        <p className="mt-1 text-[9px] tracking-[0.34em] fnaf-dim">
          MISSIONS {progressChapter}/{TOTAL_MISSIONS} · TAPES {tapes.length}/{TOTAL_TAPES}
        </p>
      </div>

      {/* opciones: columna izquierda, centrada verticalmente */}
      <div className="absolute left-10 top-1/2 -translate-y-1/2 z-10 w-[300px]">
        <button className="menu-btn fnaf-item" onClick={() => launchChapter(1, true)}>
          <span className="menu-mark">»</span>NEW CAMPAIGN
        </button>
        <button
          className="menu-btn fnaf-item"
          onClick={() => launchChapter(progressChapter)}
          disabled={unlockedChapter <= 1}
        >
          <span className="menu-mark">»</span>CONTINUE
          {unlockedChapter > 1 && <span className="menu-hint">M {String(progressChapter).padStart(2, '0')}</span>}
        </button>
        <button className="menu-btn fnaf-item" onClick={() => setPanel(panel === 'campaign' ? 'none' : 'campaign')}>
          <span className="menu-mark">»</span>CAMPAIGN
        </button>
        <button className="menu-btn fnaf-item" onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')}>
          <span className="menu-mark">»</span>SETTINGS
        </button>
        <button className="menu-btn fnaf-item" onClick={() => setPanel(panel === 'controls' ? 'none' : 'controls')}>
          <span className="menu-mark">»</span>CONTROLS
        </button>
        <button className="menu-btn fnaf-item" onClick={() => setPanel(panel === 'credits' ? 'none' : 'credits')}>
          <span className="menu-mark">»</span>CREDITS
        </button>
        {unlockedChapter > 1 && (
          <button
            className="menu-btn fnaf-item menu-danger"
            onClick={() => {
              resetSave();
              useHud.getState().setProgress(1, []);
            }}
          >
            <span className="menu-mark">»</span>ERASE PROGRESS
          </button>
        )}
      </div>

      {/* paneles flotantes a la derecha */}
      {panel === 'campaign' && (
        <div className="menu-panel absolute right-10 top-1/2 -translate-y-1/2 z-10 w-[340px] max-h-[70vh] overflow-y-auto game-scroll">
          <p className="menu-panel-title">CAMPAIGN — 8 MISSIONS, ONE NIGHT</p>
          <div className="text-[11px] leading-6 fnaf-dim">
            <p><span className="fnaf-gold">01</span> · The Key of the MegaPlex — the parking lot and the chained doors</p>
            <p><span className="fnaf-gold">02</span> · Bring the Power Back — four stations, four awakenings</p>
            <p><span className="fnaf-gold">03</span> · Golden Tokens & Buried Secrets</p>
            <p><span className="fnaf-gold">04</span> · The Office — Don't Make a Sound</p>
            <p><span className="fnaf-gold">05</span> · The Basement — The Last Way Out</p>
            <p><span className="fnaf-gold">06</span> · The Service Tunnels</p>
            <p><span className="fnaf-gold">07</span> · The Forgotten Archive</p>
            <p><span className="fnaf-gold">08</span> · The Last Chase</p>
            <p className="mt-3 text-[#5a564c]">One continuous story. Missions chain automatically — no loading screens, no level select.</p>
          </div>
        </div>
      )}

      {panel === 'settings' && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-10 w-[360px] menu-panel p-0!">
          <SettingsPanel onApply={() => {
            const s = useHud.getState().settings;
            saveSettings(s);
            getGame()?.applySettings();
          }} />
        </div>
      )}

      {panel === 'controls' && (
        <div className="menu-panel absolute right-10 top-1/2 -translate-y-1/2 z-10 w-[340px]">
          <p className="menu-panel-title">CONTROLS</p>
          <div className="grid grid-cols-[110px_1fr] gap-y-1 text-[11px] leading-6">
            <span className="fnaf-gold">W A S D</span><span>Move</span>
            <span className="fnaf-gold">MOUSE</span><span>Look around</span>
            <span className="fnaf-gold">SHIFT</span><span>Sprint (drains stamina)</span>
            <span className="fnaf-gold">CTRL</span><span>Crouch / crawl through vents</span>
            <span className="fnaf-gold">E</span><span>Interact / hold to repair</span>
            <span className="fnaf-gold">F</span><span>Flashlight</span>
            <span className="fnaf-gold">Q</span><span>Animatronic mask</span>
            <span className="fnaf-gold">C</span><span>Camera tablet</span>
            <span className="fnaf-gold">A / D</span><span>Switch camera (tablet open)</span>
            <span className="fnaf-gold">E / CLICK</span><span>Skip cinematic</span>
            <span className="fnaf-gold">ESC</span><span>Pause</span>
          </div>
        </div>
      )}

      {panel === 'credits' && (
        <div className="menu-panel absolute right-10 top-1/2 -translate-y-1/2 z-10 w-[340px]">
          <p className="menu-panel-title">CREDITS</p>
          <div className="text-[11px] leading-7 fnaf-dim">
            <p>Design, code and systems: Super Z</p>
            <p>3D models, textures, images and audio: axcgamestudios (FNAW repository)</p>
            <p>Engine: Three.js + Next.js + React</p>
            <p>Audio: repo files + real-time synthesis with Web Audio API</p>
            <p className="mt-3 text-[#5a564c]">
              Inspiration: Five Nights at Freddy&apos;s (Scott Cawthon) and
              Five Nights at Freddy&apos;s: Security Breach.
            </p>
            <p className="text-[#5a564c]">Non-profit fan project.</p>
          </div>
        </div>
      )}

      <p className="absolute bottom-4 right-6 text-[9px] tracking-[0.3em] fnaf-dim">v14 — FNAF: NEW WORLD · CONTINUOUS CAMPAIGN</p>
      <p className="absolute bottom-4 left-10 text-[9px] tracking-[0.3em] fnaf-dim">CLICK TO ENABLE SOUND</p>
    </div>
  );
}
