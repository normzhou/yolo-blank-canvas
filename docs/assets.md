# Third-party and synthesized asset provenance

The game music and backdrops are bundled in `public/tetris/` and served locally
with the app. Nothing is fetched from third-party hosts at runtime.

## Music (`tetris/*.m4a`, #232)

Full-length (~115–118s / ~2 minutes each) arcade/SNES multi-channel chiptune
arrangements synthesized at 44.1 kHz and encoded to AAC-LC `.m4a` via macOS
`afconvert` (public domain / CC0):

### Tetris Playlist (`TETRIS_PLAYLIST`)
- `korobeiniki.m4a` (*Korobeiniki (Type A)*, `117.6s`): Traditional 19th-century Russian folk song (public domain), arranged for pulse lead, harmony counter-melody, oom-pah bass, triangle arpeggios, and percussion.
- `kalinka-troika.m4a` (*Kalinka & Troika (Type B)*, `116.7s`): Traditional Russian folk medley (public domain), arranged for square-wave lead, plucked harpsichord arpeggios, bass, and percussion.
- `baroque-invention.m4a` (*Baroque Invention (Type C)*, `115.9s`): J.S. Bach *French Suite No. 3 in B minor, BWV 814 — Menuet & Trio* (public domain), arranged for harpsichord, bell chime, and bassoon-synth continuo.

### Puzzle Bobble Playlist (`PUZZLE_BOBBLE_PLAYLIST`)
- `pb-bubble-march.m4a` (*Bubble Dragon March*, `114.7s`): Original whimsical major-key marimba, bell chime, and bouncy bass arcade theme (CC0).
- `pb-rainbow-carnival.m4a` (*Rainbow Island Carnival*, `116.6s`): Original sunny tropical calypso/flute-synth arcade tune (CC0).
- `pb-starlight-carousel.m4a` (*Starlight Carousel*, `114.6s`): Original whimsical music-box & glockenspiel bounce (CC0).

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
