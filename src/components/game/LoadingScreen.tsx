'use client';

/**
 * Pantalla de carga real con progreso del constructor del mundo.
 */
import { useHud } from '@/game/core/state';

const TIPS = [
  'La caja musical del Rincón de Premios nunca debe detenerse. CAM 04.',
  'La máscara engaña a los juguetes. Al zorro y a la marioneta, no.',
  'Correr hace ruido. El ruido los atrae.',
  'La linterna congel a la coneja. Al zorro lo ahuyenta.',
  'Los conductos tienen golpes propios. Aprende a distinguirlos.',
  'Las luces parpadean antes de fallar. Ten un plan B.',
  'Los armarios del almacén sur son buenos escondites... si no te vieron entrar.',
  'La energía se agota más rápido con la tableta abierta.',
];

export default function LoadingScreen({ error }: { error: string | null }) {
  const progress = useHud((s) => s.loadingProgress);
  const label = useHud((s) => s.loadingLabel);
  const tip = TIPS[(Math.floor(progress * 8)) % TIPS.length];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020203] scanlines">
      <h1 className="text-4xl tracking-[0.4em] text-[#c83c28] title-flicker mb-2">FNAF 2</h1>
      <p className="text-xs tracking-[0.5em] text-[#6a655a] mb-12">REIMAGINADO</p>

      {error ? (
        <div className="text-center max-w-md">
          <p className="text-[#ff6a4a] mb-4">Error al iniciar el motor 3D: {error}</p>
          <p className="text-sm text-[#8a8578]">
            Tu navegador puede no soportar WebGL. Prueba con Chrome, Edge o Firefox actualizados
            y con la aceleración de hardware activada.
          </p>
          <button
            className="big-btn mt-8"
            onClick={() => window.location.reload()}
          >
            REINTENTAR
          </button>
        </div>
      ) : (
        <>
          <div className="load-bar">
            <div className="load-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-4 text-sm tracking-[0.2em] text-[#b8b2a4]">{label}</p>
          <p className="mt-1 text-xs text-[#5a564c]">{Math.round(progress * 100)}%</p>
          <p className="mt-10 max-w-md text-center text-xs leading-relaxed text-[#6a655a] italic">
            «{tip}»
          </p>
        </>
      )}
    </div>
  );
}
