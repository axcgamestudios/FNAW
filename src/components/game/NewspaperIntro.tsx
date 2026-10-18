'use client';

/**
 * Inicio FNAF 1 — el periódico: recorte envejecido con el anuncio
 * "SE BUSCA GUARDIA NOCTURNO" del Complejo Bruno. Aparece al iniciar
 * NUEVA PARTIDA; clic / ENTER / 16 s → pasa a la intro del capítulo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHud } from '@/game/core/state';

const AUTO_MS = 22000;

export default function NewspaperIntro() {
  const chapter = useHud((s) => s.chapter);
  const chapterTitle = useHud((s) => s.chapterTitle);
  const introLines = useHud((s) => s.introLines);
  const done = useRef(false);
  const [leaving, setLeaving] = useState(false);

  const advance = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    // blip real de FNAF 1 + salto a la intro del capítulo
    const game = (window as unknown as { __brunoGame?: { audio?: { camSwitch?: () => void } } }).__brunoGame;
    game?.audio?.camSwitch?.();
    setTimeout(() => useHud.getState().setMode('intro'), 700);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    const auto = window.setTimeout(advance, AUTO_MS);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(auto);
    };
  }, [advance]);

  // columnas de "texto ilegible" del periódico (solo decoración)
  const fillerCol = (lines: number, seed: number) => (
    <div className="np-fillcol" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <p key={i} style={{ width: `${58 + ((i * 17 + seed * 13) % 38)}%` }} />
      ))}
    </div>
  );

  return (
    <div className="absolute inset-0 bg-[#030302] overflow-hidden scanlines" onClick={advance}>
      {/* fondo: brasa tenue detrás del papel */}
      <div className="np-glow" />

      {/* el periódico */}
      <div className={`np-wrap ${leaving ? 'np-leave' : ''}`}>
        <div className="np-paper">
          {/* cabecera */}
          <div className="np-masthead">
            <p className="np-paper-name">THE MEGAPLEX BUGLE</p>
            <p className="np-date">NIGHT EDITION — OCTOBER 1996 — 25¢</p>
            <div className="np-rule" />
          </div>

          {/* titular */}
          <h1 className="np-headline">GRAND OPENING OF THE NIGHT SHIFT!</h1>
          <p className="np-subhead">
            The Bruno MEGAPLEX is looking for brave staff — or clueless ones — for its brand-new night crew
          </p>

          {/* anuncio clasificado */}
          <div className="np-ad">
            <p className="np-ad-tag">CLASSIFIEDS — 112</p>
            <p className="np-ad-title">WANTED</p>
            <p className="np-ad-role">NIGHT GUARD</p>
            <div className="np-ad-body">
              <p>
                <span className="np-bold">Bruno MEGAPLEX</span>. Shift runs 12 AM to 6 AM.
                Watch over the facilities, the equipment and the <span className="np-bold">animatronics</span> during
                the night.
              </p>
              <p className="np-pay">$120 PER WEEK</p>
              <p>
                We are not liable for damages, disappearances, mutilations or dismemberment.
                The company will deny all compensation should the employee be found — whole or in part —
                after their shift.
              </p>
              <p>
                Report to the <span className="np-bold">MAIN LOBBY</span> at 11:45 PM.
                Ask for <span className="np-bold">RULO</span>. One position only. Final offer.
              </p>
            </div>
          </div>

          {/* columnas de relleno */}
          <div className="np-cols">
            {fillerCol(6, 1)}
            {fillerCol(6, 2)}
            {fillerCol(6, 3)}
          </div>

          <div className="np-rule" />
          <p className="np-foot">SURVIVING THE FIRST SHIFT IS REQUIRED FOR THE SECOND</p>
        </div>
      </div>

      {/* subtítulo de capítulo + indicación */}
      <p className="np-next">CHAPTER {String(chapter).padStart(2, '0')} — {chapterTitle.toUpperCase()}</p>
      <p className="np-hint">{introLines.length ? 'PRESS ENTER TO CONTINUE' : 'PRESS ENTER TO CONTINUE'}</p>
      <div className="noise-bg" style={{ opacity: 0.07 }} />
    </div>
  );
}
