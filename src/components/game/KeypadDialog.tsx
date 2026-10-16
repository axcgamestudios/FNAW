'use client';

/**
 * Teclado numérico de puertas con código.
 */
import { useState } from 'react';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

export default function KeypadDialog() {
  const keypadDoor = useHud((s) => s.keypadDoor);
  const [code, setCode] = useState('');
  if (!keypadDoor) return null;

  const press = (d: string) => {
    if (code.length >= 4) return;
    const next = code + d;
    setCode(next);
    getGame()?.audio.keypadBeep(true);
    if (next.length === 4) {
      setTimeout(() => {
        getGame()?.keypadSubmit(next);
        setCode('');
      }, 220);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(2,2,4,0.7)' }}>
      <div className="bg-[#0c0e12] border border-[#2c3036] p-6 w-[260px]" style={{ boxShadow: '0 20px 80px rgba(0,0,0,0.9)' }}>
        <p className="text-[10px] tracking-[0.35em] text-[#8a8578] mb-1">CERROJO DIGITAL</p>
        <p className="text-[9px] tracking-[0.2em] text-[#4a4640] mb-4">ALMACÉN SUR — INTRODUCE 4 DÍGITOS</p>

        <div className="flex justify-center mb-5">
          <div className="px-6 py-2 bg-[#04060a] border border-[#1a3a22] text-[#7dcf8a] text-2xl tracking-[0.5em] min-w-[140px] text-center">
            {code.padEnd(4, '·')}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="keypad-key" onClick={() => press(d)}>{d}</button>
          ))}
          <button className="keypad-key text-sm" onClick={() => setCode('')}>C</button>
          <button className="keypad-key" onClick={() => press('0')}>0</button>
          <button
            className="keypad-key text-sm"
            onClick={() => {
              getGame()?.keypadSubmit(code);
              setCode('');
            }}
          >
            ↵
          </button>
        </div>

        <button
          className="mt-4 w-full text-[10px] tracking-[0.3em] text-[#6a655a] hover:text-[#c9c2b0] py-2"
          onClick={() => useHud.getState().setKeypad(null)}
        >
          CERRAR [ESC]
        </button>
      </div>
    </div>
  );
}
