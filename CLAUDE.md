# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VS Code extension that enables slide-by-slide navigation through Jupyter notebooks using standard slideshow cell metadata (compatible with RISE and nbconvert). Activates only when a Jupyter notebook is opened (`onNotebook:jupyter-notebook`).

## Build Commands

- `npm run compile` — compile TypeScript to `out/`
- `npm run watch` — compile in watch mode for development
- `npm run package` — create `.vsix` extension package

No test framework is currently configured.

## Architecture

Single-file implementation in `src/extension.ts` (~360 lines), compiled to `out/extension.js`. Zero runtime dependencies — only VS Code API.

The file is organized into sections:

1. **Types & constants** — `SlideType` union type; `SLIDE_TYPES` (slide/subslide) and `FRAGMENT_TYPES` (slide/subslide/fragment) sets define navigation targets for the two command granularities.

2. **Metadata extraction** — `getSlideType()` reads `cell.metadata.slideshow.slide_type` with fallback to `cell.metadata.slide_type` for non-standard notebook formats.

3. **Navigation helpers** — `buildSlideIndex()` scans all cells, filters by target set and user config (`includeSubslides`, `skipCellTypes`), returns ordered `SlideIndex[]` with cell positions and 1-based slide numbers. `navigateToCell()` sets selection and reveals at top.

4. **Commands** — `nextSlide`/`prevSlide` (parameterized by target set), `firstSlide`/`lastSlide`. Each rebuilds the index on every invocation to stay current with edits.

5. **Status bar** — Singleton `StatusBarItem` showing "Slide X/Y", updated on navigation and selection changes. Clickable (triggers nextSlide).

6. **Activation** — `activate()` registers 6 commands and subscribes to editor/selection change events. `deactivate()` disposes the status bar.

## Extension Manifest (package.json)

All 6 commands use the `jupyterSlideNav.*` namespace and `"Slide Navigator"` category. Keybindings are scoped to `notebookEditorFocused`. Three user-facing settings live under `jupyterSlideNav.*` configuration.
