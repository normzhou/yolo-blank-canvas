import pkg from './package.json';
import type { GamePackageDescriptor } from '../types';

export const prismStackDescriptor: GamePackageDescriptor = {
  id: 'prism-stack',
  packageName: pkg.name,
  version: pkg.version,
  title: 'Prism Stack',
  summary: 'Stack 3D crystal blocks, chain line clears, and shatter lock bars.',
  modeBadge: '1P & 2P Online',
  controlsLabel: 'Prism Stack controls',
  controls: [
    { keys: ['←', '→'], label: 'Move' },
    { keys: ['↑'], label: 'Rotate' },
    { keys: ['↓'], label: 'Soft drop' },
    { keys: ['Space'], label: 'Hard drop' },
  ],
};
