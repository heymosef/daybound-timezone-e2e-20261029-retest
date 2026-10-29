# Local font assets

Daybound serves the same normal variable-font faces previously delivered by its Google Fonts import. The16 WOFF2 files were downloaded unmodified from the official `fonts.gstatic.com` URLs returned by that import on2026-10-23. No font runtime package, conversion, custom subsetting, weight substitution or extra preload was introduced.

The complete distribution record is [manifest.json](../public/fonts/manifest.json): every original URL, Google delivery version, weight range, original CSS Unicode range, byte count and SHA256; each family's official source/license commit; and the reviewed font metadata. [google-fonts-baseline.css](../public/fonts/google-fonts-baseline.css) preserves the exact official delivery declaration for coverage comparison. These provenance files are documentation; application CSS fetches only the local WOFF2 files.

## Official sources and licenses

- **Geist Mono**: [Google Fonts source at `9e25e2ba265e5298f70f6182dd4e8a3ebf1b9123`](https://github.com/google/fonts/tree/9e25e2ba265e5298f70f6182dd4e8a3ebf1b9123/ofl/geistmono); [bundled SIL Open Font License1.1](../public/fonts/geistmono-OFL.txt).
- **Pixelify Sans**: [Google Fonts source at `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/pixelifysans); [bundled SIL Open Font License1.1](../public/fonts/pixelifysans-OFL.txt).
- **Inter**: [Google Fonts source at `0b58fb370093f9a9f4ff785d94405710b79de67c`](https://github.com/google/fonts/tree/0b58fb370093f9a9f4ff785d94405710b79de67c/ofl/inter); [bundled SIL Open Font License1.1](../public/fonts/inter-OFL.txt).

The source commits pin the official repository metadata/license record, not a claim that Google exposes the production WOFF2 build's source commit. The binaries pin their actual immutable Google delivery URLs (`Geist Mono/v6`, `Inter/v20`, `Pixelify Sans/v3`) and internal name-table versions below. They are byte-identical to the official downloads checked during baseline/candidate glyph verification. All original license/copyright text is included, with checksums; family names remain unchanged.

| Family | Internal version | Weights | Included delivery subsets | Total bytes |
| --- | --- | --- | --- | --- |
| Geist Mono | Version 1.701 | 100 900 | cyrillic-ext, cyrillic, symbols2, vietnamese, latin-ext, latin | 70,516 |
| Pixelify Sans | Version 1.000 | 400 700 | cyrillic, latin-ext, latin | 25,276 |
| Inter | Version 4.001;git-66647c0bb | 100 900 | cyrillic-ext, cyrillic, greek-ext, greek, vietnamese, latin-ext, latin | 218,888 |

Total committed font binary payload is314,680bytes. Unicode-range declarations retain on-demand loading: a normal Latin page requests only its active design's Latin face. Subsets for unused designs/scripts are not preloaded. The asset manifest has the detailed per-file bytes and hashes.

## Coverage and fallback

The original Google CSS ranges and actual font `cmap` are different concepts. A declared range does not mean every codepoint in that range has a glyph. FontTools4.60.2/Brotli1.2.1, installed only into an ignored local measurement environment, decoded each WOFF2's best Unicode cmap, internal version, glyph count and `wght` axis. `manifest.json` records actual compressed codepoint ranges and a sorted-cmap checksum, tied to the binary checksum. No metadata tool or Python environment is an application dependency.

Geist Mono and Pixelify Sans preserve their Latin/Cyrillic coverage and system fallback for Greek and uncovered scripts; Inter additionally preserves Greek/Greek-ext. Arrows have the same mixed font/fallback behavior as before. Japanese, Arabic and Devanagari rely on the existing system fallback stacks; the local fonts do not claim to cover them. Custom labels keep their original Unicode text.

`scripts/check-font-rendering.mjs` compares Chromium platform-font/glyph records and rendered widths in controlled family-plus-sans-serif spans for24 samples (three designs × accents/diacritics, arrows, Greek, Cyrillic, Vietnamese, Japanese, Arabic and Devanagari). The old Google-loaded production build and local candidate match exactly; there is no LastResort/missing-glyph fallback. The actual product theme fallback stacks remain unchanged. The focused browser test exercises the actual label editor and checks local loaded faces, platform glyph use/fallback and page overflow at390px and1280px. These checks go beyond `document.fonts.ready` or a computed family string.

## Delivery and updates

`src/styles/fonts.css` uses Vite-aware `/fonts/...` public asset references. Root builds serve them from `/fonts/`; relative builds rewrite them beneath the nested deployment base. `scripts/check-font-base-path.mjs` verifies all three designs beneath `/relative/` with `base:'./'`. The offline browser generator keeps `publicDir:false` and its strict CSP, copying only the runtime files named by this manifest into the fixture. Its prior Google stylesheet CSP exception has been removed.

Update binaries, original CSS record, source/license record, reviewed cmap metadata and checksums together. Download only from reviewed official sources, preserve every existing subset, and run:

```sh
node scripts/verify-font-assets.mjs
node scripts/browser-fixtures.mjs
npm run test:browser -- tests/browser/fonts.spec.ts
node scripts/check-font-base-path.mjs
```

Cold-load measurements and their practical limits are recorded in [Plan018 evidence](../plans/018-font-measurements.md). The standard global validation remains owned by the integrator.
