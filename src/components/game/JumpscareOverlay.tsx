'use client';

/**
 * Overlay de jumpscare: estática violenta, ojos brillantes y boca con dientes.
 El modelo 3D también embiste en la escena detrás.
 */
import { useHud } from '@/game/core/state';

const EYE_COLORS: Record<string, string> = {
  bear: '#4dff88',
  rabbit: '#ff5070',
  chicken: '#ffe066',
  fox: '#ffbf40',
  puppet: '#ffffff',
};

export default function JumpscareOverlay() {
  const kind = useHud((s) => s.jumpscare) ?? 'bear';
  const eye = EYE_COLORS[kind] ?? '#4dff88';

  return (
    <div className="jumpscare-overlay z-40">
      <div className="noise-bg" style={{ opacity: 0.5 }} />
      <div className="js-eye" style={{ left: 'calc(50% - 130px)', ['--eye' as string]: eye }} />
      <div className="js-eye" style={{ left: 'calc(50% + 20px)', ['--eye' as string]: eye }} />
      <div className="js-mouth" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 45%, transparent 30%, rgba(120,0,0,0.25) 90%)' }}
      />
    </div>
  );
}
