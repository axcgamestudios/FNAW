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
            <p className="np-date">EDICIÓN NOCTURNA — OCTUBRE DE 1996 — 25¢</p>
            <div className="np-rule" />
          </div>

          {/* titular */}
          <h1 className="np-headline">¡GRAN APERTURA DEL TURNO NOCTURNO!</h1>
          <p className="np-subhead">
            El Complejo Bruno MEGAPLEX busca personal valiente — o despistado — para su nueva plantilla nocturna
          </p>

          {/* anuncio clasificado */}
          <div className="np-ad">
            <p className="np-ad-tag">CLASIFICADOS — 112</p>
            <p className="np-ad-title">SE BUSCA</p>
            <p className="np-ad-role">GUARDIA NOCTURNO</p>
            <div className="np-ad-body">
              <p>
                <span className="np-bold">Complejo Bruno MEGAPLEX</span>. Turno de 12 AM a 6 AM.
                Vigilar las instalaciones, los equipos y a los <span className="np-bold">animatrónicos</span> durante
                la noche.
              </p>
              <p className="np-pay">$120 POR SEMANA</p>
              <p>
                No nos hacemos responsables de daños, desapariciones, mutilaciones o desmembramiento.
                La empresa denegará toda compensación si el empleado es encontrado — total o parcialmente —
                tras su turno.
              </p>
              <p>
                Presentarse en el <span className="np-bold">VESTÍBULO PRINCIPAL</span> a las 11:45 PM.
                Preguntar por <span className="np-bold">RULO</span>. Plaza única. Última oferta.
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
          <p className="np-foot">SOBREVIVIR EL PRIMER TURNO ES REQUISITO PARA EL SEGUNDO</p>
        </div>
      </div>

      {/* subtítulo de capítulo + indicación */}
      <p className="np-next">CAPÍTULO {String(chapter).padStart(2, '0')} — {chapterTitle.toUpperCase()}</p>
      <p className="np-hint">{introLines.length ? 'ENTER PARA CONTINUAR' : 'ENTER PARA CONTINUAR'}</p>
      <div className="noise-bg" style={{ opacity: 0.07 }} />
    </div>
  );
}
