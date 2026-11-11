import pkg from './package.json';
import type { GamePackageDescriptor } from '../types';

export const puzzleBobbleDescriptor: GamePackageDescriptor = {
  id: 'puzzle-bobble',
  packageName: pkg.name,
  version: pkg.version,
  title: 'Puzzle Bobble',
  summary: '2-player Bust-A-Move bubble battle (ASDF vs Arrows). Local to this view.',
  modeBadge: '2P Online, Versus & Solo',
  controlsLabel: 'Puzzle Bobble controls',
  controls: [
    { keys: ['A', 'D', 'S', 'F'], label: '1P Bub · Aim & Shoot' },
    { keys: ['←', '→', '↑', '↓'], label: '2P Bob · Aim & Shoot' },
  ],
};
