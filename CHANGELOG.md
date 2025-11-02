# Changelog

<!-- markdownlint-disable MD024 -->

## v25.11.1

Release date: 2025-11-02

### Fixes

- **Dependencies**: Fixed missing dependency that prevented app from starting.

## v25.11.0

Release date: 2025-11-01

### Fixes

- **JW Stream links**: Corrected handling of JW Stream links.

### Code improvements

- **Refactoring**: Destructured module imports (e.g., `fs`, `remote.app`, `shell`) and replaced `os.platform()` with native `process.platform()` for cleaner, more efficient code.
- **Code style**: Standardized variable declarations (`const`/`let`) and removed trailing semicolons in select places for consistency.
- **Dependencies**: Removed unused packages `@popperjs/core` and `loudness` to reduce bundle size.
- **Dependencies**: Routine dependency updates.

## v25.10.0

Release date: 2025-10-14

### Features

- **Action confirmations**: Optional confirmation prompt before triggering action buttons.
- **Keyboard indicators**: Visual shortcut key badges on action buttons.
- **Close application action**: Added a Close button with optional shortcut.
- **Navigation**: Press Escape to return home.

### Fixes

- **Action settings UI**: Visual bugfixes in Action buttons settings.
- **TeamViewer QS**: Resolved QuickSupport download failure.
- **Shortcuts**: Fixed various shortcut key glitches.
- **Miscellaneous**: General fixes improving stability.
- **JW Stream links**: Corrected handling of JW Stream links.
- **Build**: Fixed build script issues.
- **Input masking**: Restored non-working Zoom meeting input mask.

### Chores and Docs

- **Docs**: Revamped documentation.
- **Lockfile**: Updated `package-lock.json`.
- **Dependencies**: Routine dependency updates.
