'use client';

/**
 * Contenedor principal del juego: canvas 3D + capas de interfaz.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useHud } from '@/game/core/state';
import { setGameInstance, getGame } from '@/game/core/instance';
import type { Game } from '@/game/core/game';
import LoadingScreen from './LoadingScreen';
import MainMenu from './MainMenu';
import ChapterIntro from './ChapterIntro';
import HUD from './HUD';
import TabletView from './TabletView';
import PauseMenu from './PauseMenu';
import DeathScreen from './DeathScreen';
import ChapterCompleteScreen from './ChapterCompleteScreen';
import EndingScreen from './EndingScreen';
import KeypadDialog from './KeypadDialog';
import NoteReader from './NoteReader';
import JumpscareOverlay from './JumpscareOverlay';
import CinematicOverlay from './CinematicOverlay';

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const mode = useHud((s) => s.mode);
  const jumpscare = useHud((s) => s.jumpscare);
  const pointerHint = useHud((s) => s.pointerLockHint);
  const audioStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    (async () => {
      try {
        const { Game: GameClass } = await import('@/game/core/game');
        if (cancelled) return;
        const game = new GameClass(canvas);
        gameRef.current = game;
        setGameInstance(game);
        (window as unknown as { __brunoGame?: Game }).__brunoGame = game;
        const store = useHud.getState();
        await game.init((frac, label) => store.setLoading(frac, label));
        if (cancelled) return;
        store.setMode('menu');
      } catch (err) {
        console.error('Error de inicialización del juego:', err);
        setBootError(err instanceof Error ? err.message : 'Error desconocido');
      }
    })();
    return () => {
      cancelled = true;
      gameRef.current?.dispose();
      setGameInstance(null);
    };
  }, []);

  // Pointer lock: pistas y auto-pausa al perderlo
  useEffect(() => {
    const onChange = () => {
      const game = getGame();
      if (!game) return;
      const locked = document.pointerLockElement === canvasRef.current;
      useHud.getState().setPointerHint(!locked && game.mode === 'playing');
      if (!locked && game.mode === 'playing') {
        game.pause();
      }
    };
    const onError = () => {
      useHud.getState().setPointerHint(true);
    };
    document.addEventListener('pointerlockchange', onChange);
    document.addEventListener('pointerlockerror', onError);
    return () => {
      document.removeEventListener('pointerlockchange', onChange);
      document.removeEventListener('pointerlockerror', onError);
    };
  }, []);

  // Arranque del audio en la primera interacción
  const startAudio = useCallback(() => {
    if (audioStarted.current) return;
    audioStarted.current = true;
    const game = getGame();
    if (game) {
      game.audio.init();
      game.audio.resume();
      game.audio.startAmbient();
      // si estamos en el menú, arrancar también la música del tema (archivo real)
      if (useHud.getState().mode === 'menu') game.audio.startThemeMusic();
    }
  }, []);

  useEffect(() => {
    const handler = () => startAudio();
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [startAudio]);

  // Música del tema en el menú / final; silencio durante el juego
  useEffect(() => {
    const game = gameRef.current;
    if (!game || !game.audio.available) return;
    if (mode === 'menu' || mode === 'ending') game.audio.startThemeMusic();
    else if (mode === 'playing' || mode === 'intro') game.audio.stopThemeMusic();
  }, [mode]);

  const onCanvasClick = useCallback(() => {
    startAudio();
    const game = getGame();
    if (game) game.onCanvasClick();
  }, [startAudio]);

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" onClick={onCanvasClick} />
      <div className="noise-bg" />

      {mode === 'boot' && <LoadingScreen error={bootError} />}

      {mode === 'menu' && <MainMenu />}

      {mode === 'intro' && <ChapterIntro />}

      {(mode === 'playing' || mode === 'paused') && <HUD />}

      {mode === 'cinematic' && <CinematicOverlay />}

      {mode === 'playing' && <TabletView />}
      {mode === 'playing' && pointerHint && (
        <button
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-6 py-3 text-sm tracking-[0.25em] text-[#e8e2d0] cursor-pointer"
          style={{ background: 'rgba(8,8,10,0.85)', border: '1px solid #a8402a' }}
          onClick={onCanvasClick}
        >
          HAZ CLIC PARA CAPTURAR EL RATÓN — o mantén clic y arrastra para mirar
        </button>
      )}

      {mode === 'paused' && <PauseMenu />}

      {mode === 'dead' && <DeathScreen />}

      {mode === 'complete' && <ChapterCompleteScreen />}

      {mode === 'ending' && <EndingScreen />}

      {jumpscare && <JumpscareOverlay />}

      <KeypadDialog />
      <NoteReader />
    </div>
  );
}
