# Totem Base Themes

Official copyright-clean themes for Totem.

This repository exists both to provide a polished default experience and to serve as reference implementations for `totem-theme-sdk`.

## Initial targets

- `default` — neutral, modern, generic Totem identity
- `minimal` — low-motion/simple reference theme for accessibility and testing
- `retro-terminal` — visually distinct reference theme that exercises the theme system without depending on proprietary assets

## Themes may define

- colors/tokens
- fonts/icons
- display layouts and ambient scenes
- animations/transitions
- sound effects
- LED behavior
- persona instructions
- wake-word presentation/configuration
- TTS voice/model references

## Themes may not add capability

Themes do not receive service, filesystem, shell, MCP, or root permissions just because they are installed. Capability belongs to extensions.

Private/local character themes are valid Totem use cases but do not belong in this public repository.

## Deterministic public bundles

Run `node scripts/build-theme-bundles.mjs --out dist` to produce the canonical distributable representation for the three public themes. Each `*.theme-bundle.json` contains only ordinary files beneath that theme directory, sorted by portable relative path, with exact byte size, SHA-256, and base64 content. `index.json` binds each bundle SHA-256 to its manifest and inventory identities.

The builder fails closed on symlinks, special filesystem entries, case/Unicode-ambiguous paths, repository-only directories such as `.github`, `scripts`, `test`, or `node_modules`, and any path escaping the theme root. Repository CI builds the bundles twice and requires byte-for-byte identical output, in addition to Theme SDK contract and asset-boundary validation.
