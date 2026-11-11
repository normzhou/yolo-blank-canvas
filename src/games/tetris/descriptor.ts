import pkg from './package.json';
import type { GamePackageDescriptor } from '../types';

export const tetrisDescriptor: GamePackageDescriptor = {
  id: 'tetris',
  packageName: pkg.name,
  version: pkg.version,
  title: 'Tetris',
  summary: 'Clear lines. The board is local to this view.',
  modeBadge: '1P & 2P Online',
  controlsLabel: 'Tetris controls',
  controls: [
    { keys: ['←', '→'], label: 'Move' },
    { keys: ['↑'], label: 'Rotate' },
    { keys: ['↓'], label: 'Soft drop' },
    { keys: ['Space'], label: 'Hard drop' },
  ],
};
