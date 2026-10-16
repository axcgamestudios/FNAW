/**
 * Instancia global del juego para acceso desde componentes React.
 */
import type { Game } from './game';

let instance: Game | null = null;

export function setGameInstance(g: Game | null) {
  instance = g;
}

export function getGame(): Game | null {
  return instance;
}
