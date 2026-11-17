import pkg from './package.json';
import type { GamePackageDescriptor } from '../types';

export const microKartDescriptor: GamePackageDescriptor = {
  id: 'micro-kart',
  packageName: pkg.name,
  version: pkg.version,
  title: 'Micro Kart',
  summary: 'Auto-accelerate through 3D circuits — carve corners to charge mini-turbos.',
  modeBadge: '1P, Split-Screen & Online',
  controlsLabel: 'Micro Kart controls',
  controls: [
    { keys: ['A', 'D'], label: 'Turn & Drift (Auto-Gas)' },
    { keys: ['S'], label: 'Brake' },
    { keys: ['←', '↓', '→'], label: '1P Alt / 2P Split' },
  ],
};
