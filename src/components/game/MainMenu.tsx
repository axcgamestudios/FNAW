'use client';

/**
 * Menú principal: nueva partida, continuar, selección de noche,
 * ajustes, controles y créditos.
 */
import { useState } from 'react';
import nightsData from '@/data/nights.json';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';
import { saveSettings, resetSave } from '@/game/systems/save';
import SettingsPanel from './SettingsPanel';

type Panel = 'none' | 'nights' | 'settings' | 'controls' | 'credits';

export default function MainMenu() {
  const [panel, setPanel] = useState<Panel>('none');
  const unlockedNight = useHud((s) => s.unlockedNight);
  const tapes = useHud((s) => s.tapes);
  const setIntro = useHud((s) => s.setIntro);
  const setMode = useHud((s) => s.setMode);

  const nights = (nightsData as { nights: Array<{ night: number; title: string; intro: string[] }> }).nights;

  const launchNight = (n: number) => {
    const night = nights.find((x) => x.night === n);
    if (!night) return;
    setIntro(night.intro);
    useHud.getState().syncHud({ night: n, nightTitle: night.title });
    setMode('intro');
  };

  const continueNight = () => {
    launchNight(Math.min(unlockedNight, 5));
  };

  return (
    <div className="absolute inset-0 scanlines" style={{ background: 'radial-gradient(ellipse at 50% 40%, #0d0d10 0%, #020203 70%)' }}>
      <div className="crt-vignette" />
      {/* Ojos vigilantes al fondo */}
      <div
        className="absolute left-[18%] top-[30%] w-5 h-2.5 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, #fff 15%, #4dff88 40%, transparent 70%)', filter: 'blur(1px)' }}
      />
      <div
        className="absolute left-[19.6%] top-[30%] w-5 h-2.5 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, #fff 15%, #4dff88 40%, transparent 70%)', filter: 'blur(1px)' }}
      />

      <div className="absolute inset-0 flex flex-col md:flex-row items-center justify-center gap-16 px-8">
        <div className="text-center md:text-left md:w-[340px]">
          <h1 className="text-6xl font-bold tracking-[0.32em] text-[#c83c28] title-flicker">FNAF 2</h1>
          <p className="mt-2 text-sm tracking-[0.55em] text-[#8a8578]">REIMAGINADO</p>
          <p className="mt-8 text-xs leading-relaxed text-[#5a564c] max-w-xs mx-auto md:mx-0">
            PIZZERÍA ESTELAR BRUNO — 1987.<br />
            Cinco noches. Cinco máquinas que recuerdan.<br />
            Explora. Repara. Esquélate. Sobrevive.
          </p>
          <p className="mt-6 text-[10px] tracking-[0.2em] text-[#3a382f]">
            CINTAS: {tapes.length}/10 · NOCHES DESBLOQUEADAS: {Math.min(unlockedNight, 5)}/5
          </p>
        </div>

        <div className="w-[300px]">
          <button className="menu-btn" onClick={() => launchNight(1)}>NUEVA PARTIDA</button>
          <button className="menu-btn" onClick={continueNight} disabled={unlockedNight <= 1}>CONTINUAR</button>
          <button className="menu-btn" onClick={() => setPanel(panel === 'nights' ? 'none' : 'nights')}>
            SELECCIÓN DE NOCHE
          </button>
          <button className="menu-btn" onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')}>AJUSTES</button>
          <button className="menu-btn" onClick={() => setPanel(panel === 'controls' ? 'none' : 'controls')}>CONTROLES</button>
          <button className="menu-btn" onClick={() => setPanel(panel === 'credits' ? 'none' : 'credits')}>CRÉDITOS</button>

          {unlockedNight > 5 && (
            <button
              className="menu-btn"
              onClick={() => {
                resetSave();
                useHud.getState().setProgress(1, []);
              }}
            >
              BORRAR PROGRESO
            </button>
          )}
        </div>

        {panel === 'nights' && (
          <div className="w-[320px] max-h-[70vh] overflow-y-auto game-scroll">
            {nights.map((n) => (
              <button
                key={n.night}
                className="menu-btn"
                disabled={n.night > unlockedNight}
                onClick={() => launchNight(n.night)}
              >
                <span className="text-[#c83c28] mr-3">{String(n.night).padStart(2, '0')}</span>
                {n.night > unlockedNight ? '?? — BLOQUEADA' : n.title.toUpperCase()}
              </button>
            ))}
          </div>
        )}

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
          <div className="w-[360px] text-[11px] leading-6 text-[#8a8578] bg-[rgba(8,8,10,0.85)] border border-[#2a2a2e] p-5">
            <p className="text-[#c9c2b0] tracking-[0.25em] mb-3">CONTROLES</p>
            <div className="grid grid-cols-[110px_1fr] gap-y-1">
              <span className="text-[#d8b13a]">W A S D</span><span>Moverse</span>
              <span className="text-[#d8b13a]">RATÓN</span><span>Mirar alrededor</span>
              <span className="text-[#d8b13a]">SHIFT</span><span>Correr (consume resistencia)</span>
              <span className="text-[#d8b13a]">CTRL</span><span>Agacharse / gatear en conductos</span>
              <span className="text-[#d8b13a]">E</span><span>Interactuar / mantener para reparar</span>
              <span className="text-[#d8b13a]">F</span><span>Linterna</span>
              <span className="text-[#d8b13a]">Q</span><span>Ponerse / quitarse la máscara</span>
              <span className="text-[#d8b13a]">C</span><span>Abrir / cerrar tableta de cámaras</span>
              <span className="text-[#d8b13a]">A / D</span><span>Cambiar cámara (tableta abierta)</span>
              <span className="text-[#d8b13a]">ESPACIO</span><span>Dar cuerda a la caja musical (CAM 04)</span>
              <span className="text-[#d8b13a]">ESC</span><span>Pausa</span>
            </div>
          </div>
        )}

        {panel === 'credits' && (
          <div className="w-[360px] text-[11px] leading-7 text-[#8a8578] bg-[rgba(8,8,10,0.85)] border border-[#2a2a2e] p-5">
            <p className="text-[#c9c2b0] tracking-[0.25em] mb-3">CRÉDITOS</p>
            <p>Diseño, programación y arte procedural: Super Z</p>
            <p>Motor: Three.js + Next.js + React</p>
            <p>Audio: síntesis en tiempo real con Web Audio API</p>
            <p>Inspiración: la saga Five Nights at Freddy&apos;s de Scott Cawthon</p>
            <p className="mt-3 text-[#5a564c]">Proyecto sin ánimo de lucro. Personajes originales inspirados en la temática.</p>
            <p className="mt-3 text-[#5a564c]">Gracias por jugar. La caja musical te echa de menos.</p>
          </div>
        )}
      </div>

      <p className="absolute bottom-4 right-6 text-[9px] tracking-[0.3em] text-[#2a2a2e]">v1.0 — ESTELAR BRUNO</p>
    </div>
  );
}
