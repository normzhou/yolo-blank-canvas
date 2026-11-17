import pkg from './package.json';
import type { GamePackageDescriptor } from '../types';

export const microKartDescriptor: GamePackageDescriptor = {
  id: 'micro-kart',
  packageName: pkg.name,
  version: pkg.version,
  title: 'Micro Kart',
  summary: 'Carve 3D circuits with dual-thruster drifts and mini-turbo boosts.',
  modeBadge: '1P, Split-Screen & Online',
  controlsLabel: 'Micro Kart controls',
  controls: [
    { keys: ['A', '+', 'D'], label: 'Both · Full Thrust' },
    { keys: ['A', '/', 'D'], label: 'One · Drift & Charge' },
    { keys: ['←', '→'], label: '1P Alt / 2P Split' },
  ],
};
