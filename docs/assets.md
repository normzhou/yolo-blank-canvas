# Third-party and synthesized asset provenance

The game music and backdrops are bundled in `public/audio/` and `public/backdrops/`
and served locally with the app. Nothing is fetched from third-party hosts at runtime.

## Music (`audio/*.m4a`, #232, #234, #352)

12 full-length (~114–118s / ~2 minutes each) multi-channel chiptune and
Tone.js-style (`FMSynth`, `PolySynth`, `MembraneSynth`) arrangements synthesized
at 44.1 kHz and encoded to AAC-LC `.m4a` via macOS `afconvert` (public domain / CC0;
note: original bespoke musical composition update is tracked as Phase 4 of #351):

### Selector Screen Playlist (`SELECTOR_PLAYLIST`)
- `selector-lobby.m4a` (*Für Elise & Turkish March*, `116.0s`)
- `selector-lounge.m4a` (*Sugar Plum Fairy & Swan Lake*, `114.3s`)

### Prism Stack Playlist (`PRISM_STACK_PLAYLIST`)
- `prism-track-1.m4a` (*Folk Polka Medley I*, `117.6s`)
- `prism-track-2.m4a` (*Kalinka & Troika Medley*, `116.7s`)
- `prism-track-3.m4a` (*Baroque Invention — Bach Minuet in G*, `115.9s`)
- `prism-track-4.m4a` (*Mountain King & Ode to Joy*, `118.4s`)
- `prism-track-5.m4a` (*Greensleeves & Scarborough Fair*, `118.3s`)

### Starlight Burst Playlist (`STARLIGHT_BURST_PLAYLIST`)
- `starlight-track-1.m4a` (*Starlight Chime March*, `114.7s`)
- `starlight-track-2.m4a` (*Overworld Rag & The Entertainer*, `116.6s`)
- `starlight-track-3.m4a` (*Athletic Rag & Can-Can Galop*, `114.6s`)
- `starlight-track-4.m4a` (*Spring Meadow & William Tell Galop*, `118.3s`)
- `starlight-track-5.m4a` (*Csikós Post & Gladiators Galop*, `114.9s`)

### Spoken Countdown Sprite (`audio/countdown-voices.m4a`, #262, #331, #333)
- `countdown-voices.m4a`: 22 spoken "Ready…" / "Go!" phrase pairs generated with Microsoft Edge Neural TTS (`edge-tts`).

## Backdrops (`backdrops/*.jpg|png|gif`)

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
