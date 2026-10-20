'use client';

/**
 * HUD del juego — estilo FNAF: tipografía monoespaciada, blanca sobre negro,
 * mínima. Objetivos arriba-izquierda; batería/estado abajo-izquierda;
 * atajos abajo-derecha. Nada de cajas genéricas de juego.
 */
import { useHud } from '@/game/core/state';

export default function HUD() {
  const s = useHud();

  return (
    <div className="absolute inset-0 pointer-events-none fnaf-mono">
      {s.danger > 0.55 && <div className="danger-vignette" />}
      {s.maskOn && <div className="mask-overlay" />}

      {/* punto de mira mínimo */}
      {!s.tabletOpen && !s.cinematic && (
        <div
          className="absolute left-1/2 top-1/2 w-[3px] h-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'rgba(232,230,220,0.55)', boxShadow: '0 0 4px rgba(0,0,0,0.9)' }}
        />
      )}

      {/* objetivos — lista de tareas del turno */}
      <div className="hud-corner top-5 left-6 fnaf-objectives">
        <p className="text-[10px] tracking-[0.34em] fnaf-dim mb-1.5">
          MISSION {String(s.chapter).padStart(2, '0')} / 08
        </p>
        <p className="text-[13px] tracking-[0.18em] fnaf-gold mb-2">{s.chapterTitle.toUpperCase()}</p>
        {s.objectives.map((o) => (
          <p key={o.id} className={`${o.done ? 'done' : ''} ${o.optional ? 'opt' : ''}`}>
            <span className={o.done ? 'fnaf-green' : 'fnaf-dim'}>{o.done ? '■' : '□'}</span>{' '}
            {o.title}
          </p>
        ))}
      </div>

      {/* panel de PRUEBA activa (arriba-derecha) */}
      {s.trialActive && (
        <div className="hud-corner top-5 right-6 text-right trial-panel">
          <p className="text-[10px] tracking-[0.3em] fnaf-red">⚠ TRIAL ACTIVE</p>
          <p className="text-[12px] tracking-[0.16em] fnaf-gold mt-1">{s.trialName}</p>
          <div className="mt-2 flex gap-1.5 justify-end">
            {Array.from({ length: s.trialTasks }).map((_, i) => (
              <div key={i} className={`trial-task ${i < s.trialTasksDone ? 'done' : ''}`}>
                {i < s.trialTasksDone ? '■' : '□'}
              </div>
            ))}
          </div>
          <p className="text-[10px] tracking-[0.22em] fnaf-dim mt-1.5">
            ATTEMPT #{Math.max(1, s.trialAttempts)} · CAUGHT = RESPAWN
          </p>
        </div>
      )}

      {/* recursos abajo-izquierda: linterna + energía del edificio */}
      <div className="hud-corner bottom-5 left-6 space-y-2.5 text-[11px] tracking-[0.14em]">
        <div className="battery-widget">
          <span className="fnaf-gold text-[13px] tracking-[0.1em]" style={{ textShadow: '0 0 8px rgba(216,177,58,0.4)' }}>∞</span>
          <span className={s.flashlightOn ? 'fnaf-gold' : 'fnaf-dim'}>
            FLASHLIGHT {s.flashlightOn ? 'ON' : 'OFF'}
          </span>
          <span className="fnaf-dim text-[10px]">[F]</span>
        </div>
        <div className="battery-widget">
          <div className="battery-shell" style={{ width: 46 }}>
            <div className="battery-cells">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={`battery-cell ${i < Math.ceil((s.power / 100) * 3) ? 'on' : ''} ${s.power < 20 ? 'low' : ''}`}
                  style={{ background: i < Math.ceil((s.power / 100) * 3) ? (s.power < 20 ? '#c83428' : '#4a8a9a') : undefined }}
                />
              ))}
            </div>
          </div>
          <span className={s.power < 20 ? 'fnaf-red' : 'fnaf-dim'}>POWER</span>
        </div>
        {s.stamina < 30 && (
          <p className="fnaf-red text-[10px] tracking-[0.22em]">STAMINA DEPLETED — SLOWED DOWN</p>
        )}
      </div>

      {/* atajos abajo-derecha (discretos, se iluminan al usar) */}
      <div className="hud-corner bottom-5 right-6 text-right space-y-1.5 text-[10px] tracking-[0.2em]">
        <p className={s.maskOn ? 'fnaf-gold' : 'fnaf-dim'}>[Q] MASK{s.maskOn ? ' — ON' : ''}</p>
        <p className={s.tabletOpen ? 'fnaf-gold' : 'fnaf-dim'}>[C] CAMERAS</p>
        {s.crouching && <p className="fnaf-dim">CROUCHED [CTRL]</p>}
        {s.inVent && <p className="fnaf-gold">IN VENT</p>}
      </div>

      {s.alert && <div className="alert-toast fnaf-mono">{s.alert}</div>}

      {s.prompt && !s.tabletOpen && (
        <div className="prompt-box fnaf-prompt fnaf-mono">
          <span className="key-badge">E</span>
          {s.prompt}
          {s.holdProgress !== null && (
            <div className="hud-bar ml-3" style={{ width: 120 }}>
              <div className="hud-bar-fill" style={{ width: `${s.holdProgress * 100}%`, background: '#d8b13a' }} />
            </div>
          )}
        </div>
      )}

      {s.subtitle && <div className="subtitle-bar">{s.subtitle}</div>}
    </div>
  );
}
