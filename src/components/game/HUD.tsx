'use client';

/**
 * HUD del juego: objetivos, reloj, recursos, avisos, subtítulos y
capas de estado (máscara, peligro, conductos).
 */
import { useHud } from '@/game/core/state';

function formatClock(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  const hh = h === 0 ? 12 : h;
  return `${hh}:${String(m).padStart(2, '0')} AM`;
}

function Bar({ value, color, warn }: { value: number; color: string; warn?: boolean }) {
  return (
    <div className="hud-bar">
      <div
        className="hud-bar-fill"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: warn ? '#c83428' : color,
          boxShadow: warn ? '0 0 8px rgba(200,52,40,0.8)' : 'none',
        }}
      />
    </div>
  );
}

export default function HUD() {
  const s = useHud();
  const hourStr = formatClock(s.hour);
  const batteryWarn = s.battery < 20;
  const musicWarn = s.musicBox < 25;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* viñeta de peligro */}
      {s.danger > 0.55 && <div className="danger-vignette" />}

      {/* máscara puesta */}
      {s.maskOn && <div className="mask-overlay" />}

      {/* mira central */}
      {!s.tabletOpen && (
        <div
          className="absolute left-1/2 top-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'rgba(230,225,210,0.6)', boxShadow: '0 0 3px rgba(0,0,0,0.9)' }}
        />
      )}

      {/* objetivos */}
      <div className="hud-corner top-4 left-4 max-w-[300px]">
        <p className="text-[10px] tracking-[0.3em] text-[#6a655a] mb-1">
          NOCHE {String(s.night).padStart(2, '0')} — OBJETIVOS
        </p>
        {s.objectives.map((o) => (
          <p
            key={o.id}
            className={`text-[11px] leading-5 ${o.done ? 'objective-done text-[#5a6a55]' : 'text-[#b8b2a4]'} ${o.optional ? 'opacity-60' : ''}`}
          >
            <span className={o.done ? 'text-[#4a8a55]' : 'text-[#c8a13a]'}>{o.done ? '■' : '□'}</span>{' '}
            {o.title}
          </p>
        ))}
      </div>

      {/* reloj */}
      <div className="hud-corner top-4 right-6 text-right">
        <p className="hud-clock">{hourStr}</p>
        <p className="text-[10px] tracking-[0.35em] text-[#6a655a]">
          NOCHE {String(s.night).padStart(2, '0')} · {s.nightTitle}
        </p>
      </div>

      {/* recursos abajo-izquierda */}
      <div className="hud-corner bottom-4 left-4 space-y-2">
        <div>
          <p className="text-[9px] tracking-[0.25em] text-[#6a655a] mb-0.5">
            LINTERNA {s.flashlightOn ? '● ENCENDIDA' : '○ APAGADA'} — [F]
          </p>
          <Bar value={s.battery} color="#d8b13a" warn={batteryWarn} />
        </div>
        <div>
          <p className="text-[9px] tracking-[0.25em] text-[#6a655a] mb-0.5">
            RESISTENCIA {s.stamina < 25 ? '— AGOTADA' : ''}
          </p>
          <Bar value={s.stamina} color="#4a8a55" />
        </div>
        <div>
          <p className="text-[9px] tracking-[0.25em] text-[#6a655a] mb-0.5">ENERGÍA DEL EDIFICIO</p>
          <Bar value={s.power} color="#3a7ac8" warn={s.power < 15} />
        </div>
      </div>

      {/* indicadores abajo-derecha */}
      <div className="hud-corner bottom-4 right-6 text-right space-y-1 text-[10px] tracking-[0.2em]">
        <p className={s.maskOn ? 'text-[#d8a13a]' : 'text-[#4a4640]'}>[Q] MÁSCARA {s.maskOn ? 'PUESTA' : ''}</p>
        <p className={musicWarn ? 'text-[#c83428]' : 'text-[#4a4640]'}>
          CAJA MUSICAL {Math.round(s.musicBox)}%{musicWarn ? ' — ¡CUERDA YA! CAM 04' : ''}
        </p>
        <p className="text-[#4a4640]">[C] CÁMARAS</p>
        {s.crouching && <p className="text-[#8a8578]">AGACHADO — [CTRL]</p>}
        {s.inVent && <p className="text-[#d8a13a]">EN CONDUCTO</p>}
      </div>

      {/* aviso superior */}
      {s.alert && <div className="alert-toast">{s.alert}</div>}

      {/* prompt de interacción */}
      {s.prompt && !s.tabletOpen && (
        <div className="prompt-box">
          {s.prompt}
          {s.holdProgress !== null && (
            <div className="hud-bar mt-2" style={{ width: 180 }}>
              <div className="hud-bar-fill" style={{ width: `${s.holdProgress * 100}%`, background: '#c8a13a' }} />
            </div>
          )}
        </div>
      )}

      {/* subtítulos (llamadas telefónicas) */}
      {s.subtitle && <div className="subtitle-bar">{s.subtitle}</div>}
    </div>
  );
}
