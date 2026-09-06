# Default Phase 1 theme fixture

This directory is intentionally a minimal, copyright-clean first-party discovery fixture for Totem Phase 1.

It uses the same `totem.theme/v0` manifest path scanned for third-party themes. It declares identity and default enablement only: no capability or permission fields are present, preserving the hard theme security boundary.

Its purpose is to prove Totem can discover and select a real `default` package from the public `totem-base-themes` repository without special-casing first-party packages. Rich visual assets remain deferred to the theme SDK phases.
