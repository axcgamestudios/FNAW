'use client';

/**
 * Pantalla de carga FNAW MEGAPLEX: imagen real del repo (la pizzería en
 * llamas con Freddy quemado) bajo estática CRT, barra segmentada roja,
 * porcentaje y consejos reales del juego.
 */
import { useHud } from '@/game/core/state';

const TIPS = [
  'Eres el nuevo GUARDIA NOCTURNO: $120 a la semana. Tu LINTERNA espera en el escritorio de la Oficina.',
  'En la GUARDERÍA ESTRELLITA, camina por el borde de la alberca: las pelotas suenan como fuegos artificiales.',
  'El ATRIO CENTRAL es el corazón del MEGAPLEX: la estatua dorada de Freddy te vigila desde el sur.',
  'La bolera de Bruno es su territorio. Si las luces se funden, no estás solo en el carril.',
  'El telón de la Cala del Pirata se mueve solo. Cuenta las veces. Tres es mal número.',
  'Los generadores maestros arrancan en orden 3 · 1 · 4 · 2. Dorado despierta al tercero.',
  'GALERÍA TÉCNICA a ciegas: escucha el ZUMBIDO del ventilador y las OLLAS antes de abrir puerta.',
  'La risa metálica tras una puerta de servicio no es una invitación. No la abras. Jamás.',
  'El SÓTANO guarda la pizzería ORIGINAL ardiendo. Siete extintores. Luna cae del techo.',
  'Si superas a SOL Y LUNA, la SALIDA se abre. Corre al vestíbulo. No mires atrás.',
  'Correr hace ruido. El ruido los atrae. A veces es mejor quedarse quieto.',
  'Si te atrapan durante una prueba, reapareces: las tareas se reinician, el miedo no.',
];

export default function LoadingScreen({ error }: { error: string | null }) {
  const progress = useHud((s) => s.loadingProgress);
  const label = useHud((s) => s.loadingLabel);
  const tip = TIPS[(Math.floor(progress * TIPS.length)) % TIPS.length];
  const pct = Math.round(progress * 100);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020203] scanlines overflow-hidden">
      {/* imagen de fondo real del repo (FNAF: NEW WORLD en llamas) */}
      <img src="/images/loading_bg.jpeg" alt="" className="menu-bg-img" draggable={false} />
      <div className="load-bg-shade" />
      <div className="noise-bg" style={{ opacity: 0.14 }} />
      <div className="crt-vignette" />
      <div className="menu-crt-bars" />

      <p className="mt-3 mb-10 text-[9px] tracking-[0.4em] fnaf-dim z-10">COMPLEJO BRUNO — CARGANDO INSTALACIONES</p>

      {error ? (
        <div className="text-center max-w-md z-10">
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
        <div className="z-10 flex flex-col items-center">
          <div className="load-bar">
            <div className="load-fill" style={{ width: `${pct}%` }} />
            <div className="load-ticks" />
          </div>
          <p className="load-pct">{pct}%</p>
          <p className="mt-2 text-xs tracking-[0.22em] text-[#b8b2a4]">{label}</p>
          <p className="mt-10 max-w-md text-center text-xs leading-relaxed text-[#6a655a] italic">
            «{tip}»
          </p>
        </div>
      )}
    </div>
  );
}
