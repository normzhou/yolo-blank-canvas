# Third-party asset provenance

The Tetris music and backdrops are sourced free assets, bundled in
`public/tetris/` and served with the app. Nothing is fetched at runtime.

## Music (`tetris/*.m4a`)

- Pack: "NES Shooter Music (5 tracks, 3 jingles)" by SketchyLogic
- Source: https://opengameart.org/content/nes-shooter-music-5-tracks-3-jingles
- License: CC0 (public domain); attribution optional
- Tracks: `map.m4a`, `mars.m4a`, `mercury.m4a`, `venus.m4a`, `boss.m4a`
  (BossMain from the "Boss" track), converted from the pack's WAV files
  to AAC-LC `.m4a` with macOS `afconvert`.

## Backdrops (`tetris/*.jpg|png|gif`)

| File | Scene | Source | Author | License |
| --- | --- | --- | --- | --- |
| `night-sky.jpg` | Night Sky | [Perfectly Seamless Night Sky](https://opengameart.org/content/perfectly-seamless-night-sky) | LuminousDragonGames | CC0 |
| `city-night.png` | City at Night | [Parallax City – Night (4 Colors)](https://opengameart.org/content/parallax-city-night-4-colors) | FisherG | CC0 |
| `desert.png` | Desert Dunes | [Cethiel's Desert Background Redux](https://opengameart.org/content/cethiels-desert-background-redux) | Emcee Flesher | CC0 / OGA-BY 3.0 |
| `mars.jpg` | Red Planet | [Mars Background Pixel Art](https://opengameart.org/content/mars-background-pixel-art) | Quantiset | CC0 |
| `space.jpg` | Deep Space | [2D space background](https://opengameart.org/content/2d-space-background) | Scribe (Daniel Stephens) | CC0 |
| `castle.gif` | Castle in the Dark | [Castle in the Dark](https://opengameart.org/content/castle-in-the-dark) | biodegradableguy | CC0 |

Large images were downscaled/encoded to JPEG quality ~80 with macOS `sips`
to keep the distributed bundle small; pixel art is kept as PNG, and the
castle scene as its original animated GIF.
