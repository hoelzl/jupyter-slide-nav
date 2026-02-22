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

Single-file implementation in `src/extension.ts` (~590 lines), compiled to `out/extension.js`. Zero runtime dependencies — only VS Code API.

The file is organized into sections:

1. **Types & constants** — `SlideType` union type; `SLIDE_TYPES` (slide/subslide) and `FRAGMENT_TYPES` (slide/subslide/fragment) sets define navigation targets for the two command granularities.

2. **Slide view state** — `slideViewState` map tracks which notebooks have slide view active (keyed by URI). `slideViewPendingReinsert` set tracks notebooks needing spacer re-insertion after save. `isSpacerCell()` detects spacer cells via `jupyterSlideNav.spacer` metadata marker. `createSentinelCellData()` builds a tiny 1-line markdown cell; `createSpacerCellData()` builds a large markdown cell with `&nbsp;` paragraphs for content-based spacing. Both share `SPACER_METADATA` (includes `slide_type: "skip"`).

3. **Metadata extraction** — `getSlideType()` reads `cell.metadata.slideshow.slide_type` with fallback to `cell.metadata.slide_type` for non-standard notebook formats.

4. **Navigation helpers** — `buildSlideIndex()` scans all cells, skips spacer cells, filters by target set and user config (`includeSubslides`, `skipCellTypes`), returns ordered `SlideIndex[]` with cell positions and 1-based slide numbers. `navigateToCell()` sets selection and reveals at top.

5. **Commands** — `nextSlide`/`prevSlide` (parameterized by target set), `firstSlide`/`lastSlide`. Each rebuilds the index on every invocation to stay current with edits.

6. **Status bar** — Singleton `StatusBarItem` showing "Slide X/Y", updated on navigation and selection changes. Clickable (triggers nextSlide). Shows a layout icon when slide view is active.

7. **Slide view** — `insertSpacers()` builds the slide index and inserts a sentinel + spacer cell pair before each slide boundary (except the first), processing bottom-to-top. The sentinel is a tiny cell so Shift+Enter doesn't scroll the slide away; the spacer provides the visual gap. `removeSpacers()` deletes all cells with spacer metadata. `toggleSlideView()` is the command handler that toggles spacers on/off.

8. **Activation** — `activate()` registers 7 commands, subscribes to editor/selection change events, and sets up save handlers (`onWillSaveNotebookDocument`/`onDidSaveNotebookDocument`) to transparently remove and re-insert spacers around saves. Also handles notebook close cleanup and orphan spacer removal on startup. `deactivate()` disposes the status bar and clears slide view state.

## Extension Manifest (package.json)

All 7 commands use the `jupyterSlideNav.*` namespace and `"Slide Navigator"` category. Keybindings are scoped to `notebookEditorFocused`. Four user-facing settings live under `jupyterSlideNav.*` configuration.
