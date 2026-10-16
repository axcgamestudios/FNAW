'use client';

/**
 * Menú principal estilo FNAF 2: el rostro de Freddy renderizado en 3D
 * detrás de una capa de estática, opciones minimalistas en blanco.
 */
import { useState } from 'react';
import chaptersData from '@/data/chapters.json';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';
import { saveSettings, resetSave } from '@/game/systems/save';
import SettingsPanel from './SettingsPanel';

type Panel = 'none' | 'chapters' | 'settings' | 'controls' | 'credits';

export default function MainMenu() {
  const [panel, setPanel] = useState<Panel>('none');
  const unlockedChapter = useHud((s) => s.unlockedChapter);
  const tapes = useHud((s) => s.tapes);
  const setIntro = useHud((s) => s.setIntro);

  const chapters = (chaptersData as { chapters: Array<{ chapter: number; title: string; lines: string[] }> }).chapters;

  const launchChapter = (n: number) => {
    const ch = chapters.find((x) => x.chapter === n);
    if (!ch) return;
    setIntro(ch.lines);
    useHud.getState().syncHud({ chapter: n, chapterTitle: ch.title });
    useHud.getState().setMode('intro');
  };

  return (
    <div className="absolute inset-0 scanlines">
      {/* estática fuerte sobre Freddy */}
      <div className="noise-bg" style={{ opacity: 0.16 }} />
      <div className="crt-vignette" />

      {/* opciones estilo FNAF: columna izquierda discreta */}
      <div className="absolute left-10 top-1/2 -translate-y-1/2 z-10 w-[280px]">
        <button className="menu-btn fnaf-item" onClick={() => launchChapter(1)}>NUEVA PARTIDA</button>
        <button className="menu-btn fnaf-item" onClick={() => launchChapter(Math.min(unlockedChapter, 4))} disabled={unlockedChapter <= 1}>
          CONTINUAR
        </button>
        <button className="menu-btn fnaf-item" onClick={() => setPanel(panel === 'chapters' ? 'none' : 'chapters')}>CAPÍTULOS</button>
        <button className="menu-btn fnaf-item" onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')}>AJUSTES</button>
        <button className="menu-btn fnaf-item" onClick={() => setPanel(panel === 'controls' ? 'none' : 'controls')}>CONTROLES</button>
        <button className="menu-btn fnaf-item" onClick={() => setPanel(panel === 'credits' ? 'none' : 'credits')}>CRÉDITOS</button>
        {unlockedChapter > 4 && (
          <button
            className="menu-btn fnaf-item"
            onClick={() => {
              resetSave();
              useHud.getState().setProgress(1, []);
            }}
          >
            BORRAR PROGRESO
          </button>
        )}
      </div>

      {/* título */}
      <div className="absolute top-12 left-10 z-10">
        <h1 className="text-6xl font-bold tracking-[0.18em] text-[#e8e2d0] title-flicker">FNAW</h1>
        <p className="mt-1 text-[11px] tracking-[0.55em] text-[#6a655a]">VIGILIA EN LA PIZZERÍA ESTELAR</p>
        <p className="mt-3 text-[9px] tracking-[0.3em] text-[#3a382f]">
          CINTAS {tapes.length}/11 · CAPÍTULOS {Math.min(unlockedChapter, 4)}/4
        </p>
      </div>

      {/* paneles flotantes a la derecha */}
      {panel === 'chapters' && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-10 w-[300px] max-h-[70vh] overflow-y-auto game-scroll bg-[rgba(4,4,6,0.92)] border border-[#2a2a2e] p-4">
          {chapters.map((c) => (
            <button
              key={c.chapter}
              className="menu-btn fnaf-item"
              disabled={c.chapter > unlockedChapter}
              onClick={() => launchChapter(c.chapter)}
            >
              <span className="text-[#c83428] mr-3">{String(c.chapter).padStart(2, '0')}</span>
              {c.chapter > unlockedChapter ? '?? — BLOQUEADO' : c.title.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {panel === 'settings' && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-10 w-[360px]">
          <SettingsPanel onApply={() => {
            const s = useHud.getState().settings;
            saveSettings(s);
            getGame()?.applySettings();
          }} />
        </div>
      )}

      {panel === 'controls' && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-10 w-[340px] text-[11px] leading-6 text-[#8a8578] bg-[rgba(4,4,6,0.92)] border border-[#2a2a2e] p-5">
          <p className="text-[#c9c2b0] tracking-[0.25em] mb-3">CONTROLES</p>
          <div className="grid grid-cols-[110px_1fr] gap-y-1">
            <span className="text-[#d8b13a]">W A S D</span><span>Moverse</span>
            <span className="text-[#d8b13a]">RATÓN</span><span>Mirar alrededor</span>
            <span className="text-[#d8b13a]">SHIFT</span><span>Correr (consume resistencia)</span>
            <span className="text-[#d8b13a]">CTRL</span><span>Agacharse / gatear en conductos</span>
            <span className="text-[#d8b13a]">E</span><span>Interactuar / mantener para reparar</span>
            <span className="text-[#d8b13a]">F</span><span>Linterna</span>
            <span className="text-[#d8b13a]">Q</span><span>Máscara de animatrónico</span>
            <span className="text-[#d8b13a]">C</span><span>Tableta de cámaras</span>
            <span className="text-[#d8b13a]">A / D</span><span>Cambiar cámara (tableta abierta)</span>
            <span className="text-[#d8b13a]">E / CLIC</span><span>Saltar cinemática</span>
            <span className="text-[#d8b13a]">ESC</span><span>Pausa</span>
          </div>
        </div>
      )}

      {panel === 'credits' && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-10 w-[340px] text-[11px] leading-7 text-[#8a8578] bg-[rgba(4,4,6,0.92)] border border-[#2a2a2e] p-5">
          <p className="text-[#c9c2b0] tracking-[0.25em] mb-3">CRÉDITOS</p>
          <p>Diseño, programación y sistemas: Super Z</p>
          <p>Modelos 3D: axcgamestudios (repositorio FNAW)</p>
          <p>Texturas: axcgamestudios + generación procedural</p>
          <p>Motor: Three.js + Next.js + React</p>
          <p>Audio: síntesis en tiempo real con Web Audio API</p>
          <p className="mt-3 text-[#5a564c]">Inspiración: Five Nights at Freddy&apos;s (Scott Cawthon) y Five Nights at Freddy&apos;s: Security Breach.</p>
          <p className="mt-3 text-[#5a564c]">Proyecto fan sin ánimo de lucro.</p>
        </div>
      )}

      <p className="absolute bottom-4 right-6 text-[9px] tracking-[0.3em] text-[#2a2a2e]">v2.0 — FNAW</p>
      <p className="absolute bottom-4 left-10 text-[9px] tracking-[0.3em] text-[#2a2a2e]">HAZ CLIC PARA ACTIVAR EL SONIDO</p>
    </div>
  );
}
