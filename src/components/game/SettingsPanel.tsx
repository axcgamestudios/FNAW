'use client';

/**
 * Ajustes: volúmenes, sensibilidad, invertir Y, calidad gráfica.
 */
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block mb-4">
      <span className="flex justify-between text-[11px] tracking-[0.2em] text-[#8a8578] mb-1">
        <span>{label}</span>
        <span className="text-[#d8b13a]">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
        className="w-full accent-[#c83c28]"
      />
    </label>
  );
}

export default function SettingsPanel({ onApply }: { onApply?: () => void }) {
  const settings = useHud((s) => s.settings);
  const setSettings = useHud((s) => s.setSettings);

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    getGame()?.applySettings();
    onApply?.();
  };

  return (
    <div className="bg-[rgba(8,8,10,0.85)] border border-[#2a2a2e] p-5">
      <p className="text-[#c9c2b0] tracking-[0.25em] mb-4 text-xs">SETTINGS</p>
      <Slider label="MASTER VOLUME" value={settings.master} onChange={(v) => update({ master: v })} />
      <Slider label="MUSIC & AMBIENCE" value={settings.music} onChange={(v) => update({ music: v })} />
      <Slider label="SOUND EFFECTS" value={settings.sfx} onChange={(v) => update({ sfx: v })} />
      <Slider label="MOUSE SENSITIVITY" value={settings.sensitivity} onChange={(v) => update({ sensitivity: Math.max(0.15, v * 1.6) })} />

      <label className="flex items-center justify-between mb-4 text-[11px] tracking-[0.2em] text-[#8a8578] cursor-pointer">
        <span>INVERT VERTICAL AXIS</span>
        <input
          type="checkbox"
          checked={settings.invertY}
          onChange={(e) => update({ invertY: e.target.checked })}
          className="accent-[#c83c28] w-4 h-4"
        />
      </label>

      <p className="text-[11px] tracking-[0.2em] text-[#8a8578] mb-2">GRAPHICS QUALITY</p>
      <div className="flex gap-2 mb-2">
        {(['low', 'medium', 'high'] as const).map((q) => (
          <button
            key={q}
            onClick={() => update({ quality: q })}
            className={`flex-1 py-2 text-[10px] tracking-[0.15em] border cursor-pointer transition-colors ${
              settings.quality === q
                ? 'bg-[#c83c28] text-white border-[#c83c28]'
                : 'bg-[#14161a] text-[#8a8578] border-[#2c3036] hover:bg-[#22262c]'
            }`}
          >
            {q === 'low' ? 'LOW' : q === 'medium' ? 'MEDIUM' : 'HIGH'}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-[#5a564c] leading-4">
        Low: no dynamic shadows · Medium: flashlight shadows · High: full shadows and dust.
        Quality adjusts automatically if performance drops.
      </p>
    </div>
  );
}
