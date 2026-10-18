'use client';

/**
 * Lector de notas y cintas. El juego sigue corriendo mientras lees...
 */
import { useEffect } from 'react';
import { useHud } from '@/game/core/state';
import { getGame } from '@/game/core/instance';

export default function NoteReader() {
  const note = useHud((s) => s.note);
  const isTape = note?.id.startsWith('tape_');

  useEffect(() => {
    if (!note) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Escape') {
        getGame()?.closeNote();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [note]);

  if (!note) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(2,2,4,0.55)' }}>
      {isTape ? (
        <div className="relative max-w-xl w-[92%] bg-[#0a0c10] border border-[#2a2e34] p-8" style={{ boxShadow: '0 30px 90px rgba(0,0,0,0.95)' }}>
          <div className="scanlines absolute inset-0 pointer-events-none opacity-60" />
          <p className="text-[10px] tracking-[0.4em] text-[#7dcf8a] mb-4">PLAYING TAPE...</p>
          <h3 className="text-lg text-[#c9c2b0] tracking-[0.15em] mb-6">{note.title.toUpperCase()}</h3>
          <div className="mb-6 h-1 bg-[#0e1810] relative overflow-hidden">
            <div className="absolute inset-y-0 bg-[#2d8a42] left-0" style={{ animation: 'glitch-slide 14s linear forwards', width: '100%' }} />
          </div>
          <p className="text-sm leading-8 text-[#9a9488] italic">{note.text}</p>
          <button
            className="mt-8 text-[10px] tracking-[0.3em] text-[#6a655a] hover:text-[#c9c2b0]"
            onClick={() => getGame()?.closeNote()}
          >
            STOP [E]
          </button>
        </div>
      ) : (
        <div className="note-paper">
          <h3 className="text-base tracking-[0.2em] mb-5 border-b border-[rgba(60,50,30,0.4)] pb-3">{note.title}</h3>
          <p className="text-sm whitespace-pre-line">{note.text}</p>
          <button
            className="mt-7 text-[10px] tracking-[0.3em] text-[#6a5a40] hover:text-[#2a2620] border border-[#6a5a40] px-4 py-2"
            onClick={() => getGame()?.closeNote()}
          >
            SAVE & CLOSE [E]
          </button>
        </div>
      )}
      <p className="absolute bottom-10 text-[10px] tracking-[0.3em] text-[#8a8578]">
        THE GAME KEEPS RUNNING WHILE YOU READ — DON'T STAY TOO LONG
      </p>
    </div>
  );
}
