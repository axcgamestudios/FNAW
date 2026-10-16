'use client';

/**
 * Overlay de JUMPSCARE estilo FNAF: estrobo violento, desgarros de señal,
 * aberración RGB y parpadeo caótico. El modelo 3D GLB embiste detrás a
 * cámara lenta cero (a 1 m de la cara, temblando).
 */
import { useHud } from '@/game/core/state';

export default function JumpscareOverlay() {
  const kind = useHud((s) => s.jumpscare) ?? 'bear';

  return (
    <div className="jumpscare-overlay z-40" data-kind={kind}>
      {/* estrobo base (fotogramas rojo/blanco a máxima agresividad) */}
      <div className="js-strobe" />
      {/* ruido de señal violento */}
      <div className="noise-bg" style={{ opacity: 0.55 }} />
      {/* desgarros horizontales de señal (glitch) */}
      <div className="js-tear" style={{ top: '12%' }} />
      <div className="js-tear" style={{ top: '38%', animationDelay: '0.04s' }} />
      <div className="js-tear" style={{ top: '61%', animationDelay: '0.08s' }} />
      <div className="js-tear" style={{ top: '83%', animationDelay: '0.02s' }} />
      {/* aberración cromática en franjas */}
      <div className="js-rgb js-rgb-r" />
      <div className="js-rgb js-rgb-b" />
      {/* destellos de flash blanco */}
      <div className="js-flash" />
      {/* viñeta de sangre */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 42%, transparent 18%, rgba(90,0,0,0.55) 78%, rgba(20,0,0,0.92) 100%)' }}
      />
    </div>
  );
}
