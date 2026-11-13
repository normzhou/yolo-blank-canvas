import pkg from './package.json';
import type { GamePackageDescriptor } from '../types';

export const starlightBurstDescriptor: GamePackageDescriptor = {
  id: 'starlight-burst',
  packageName: pkg.name,
  version: pkg.version,
  title: 'Starlight Burst',
  summary: 'Aim, bank off stardust walls, and pop 3D star-orbs solo or head-to-head.',
  modeBadge: '2P Online, Versus & Solo',
  controlsLabel: 'Starlight Burst controls',
  controls: [
    { keys: ['A', 'D', 'S', 'F'], label: '1P · Tilt & Launch' },
    { keys: ['←', '→', '↑', '↓'], label: '2P · Tilt & Launch' },
  ],
};
