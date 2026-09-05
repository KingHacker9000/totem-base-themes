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

Implementation begins after the theme SDK has a working v0 contract.
