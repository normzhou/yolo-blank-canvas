import pkg from './package.json';
import type { GamePackageDescriptor } from '../types';

export const starlightBurstDescriptor: GamePackageDescriptor = {
  id: 'starlight-burst',
  packageName: pkg.name,
  version: pkg.version,
  title: 'Starlight Burst',
  summary: '2-player celestial star-core battle (ASDF vs Arrows). Local to this view.',
  modeBadge: '2P Online, Versus & Solo',
  controlsLabel: 'Starlight Burst controls',
  controls: [
    { keys: ['A', 'D', 'S', 'F'], label: '1P · Tilt & Launch' },
    { keys: ['←', '→', '↑', '↓'], label: '2P · Tilt & Launch' },
  ],
};
