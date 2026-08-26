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

Single-file implementation in `src/extension.ts` (~820 lines), compiled to `out/extension.js`. Zero runtime dependencies — only VS Code API.

The file is organized into sections:

1. **Types & constants** — `SlideType` union type; `SLIDE_TYPES` (slide/subslide) and `FRAGMENT_TYPES` (slide/subslide/fragment) sets define navigation targets for the two command granularities.

2. **Diagnostics** — `diagLog()` writes timestamped lines to a lazily created "Slide Navigator" output channel (View → Output); `describeEditorState()` formats the editor's selections and visible ranges. Navigation commands, selection-loss events, and fallback paths log here to diagnose unexpected jumps.

3. **Slide view state** — `slideViewState` map tracks which notebooks have slide view active (keyed by URI). `isSpacerCell()` detects spacer cells via `jupyterSlideNav.spacer` metadata marker. `createSentinelCellData()` builds a tiny 1-line markdown cell; `createSpacerCellData()` builds a large markdown cell with `&nbsp;` paragraphs for content-based spacing. Both share `SPACER_METADATA` (includes `slide_type: "skip"`).

4. **Metadata extraction** — `getSlideType()` reads `cell.metadata.slideshow.slide_type` with fallback to `cell.metadata.slide_type` for non-standard notebook formats.

5. **Navigation helpers** — `buildSlideIndex()` scans all cells, skips spacer cells, filters by target set and user config (`includeSubslides`, `skipCellTypes`), returns ordered `SlideIndex[]` with cell positions and 1-based slide numbers. `navigateToCell()` sets selection and reveals at top. `getCurrentCellIndex()` reads the first non-empty selection; when the selection is missing or collapsed (VS Code clears it when the notebook editor loses focus, e.g. to an output webview or another window), it anchors on the first visible cell instead of defaulting to cell 0 — the old cell-0 fallback made navigation jump back to the first slide.

6. **Commands** — `nextSlide`/`prevSlide` (parameterized by target set), `firstSlide`/`lastSlide`, `goToSlide` (a filterable QuickPick overview of all slides), and `navigateBack`. Each rebuilds the index on every invocation to stay current with edits.

   **Navigation history** — a `navigationHistory` map (URI → cell-index stack) records the prior position before each jump via `pushHistory()`; `navigateBack()` pops it to recover from accidental jumps. Cleared on notebook close and in `deactivate()`.

7. **Status bar** — Singleton `StatusBarItem` showing "Slide X/Y", updated on navigation and selection changes. Clickable (triggers nextSlide). Shows a layout icon when slide view is active.

8. **Slide view** — `insertSpacers()` builds the slide index and inserts a sentinel + spacer cell pair before each slide boundary (except the first), processing bottom-to-top. The sentinel is a tiny cell so Shift+Enter doesn't scroll the slide away; the spacer provides the visual gap. `removeSpacers()` deletes all cells with spacer metadata. `toggleSlideView()` is the command handler that toggles spacers on/off.

   Spacer cells deliberately **persist to disk** (their metadata carries `slide_type: "skip"` so they don't affect RISE/nbconvert output). An earlier design removed spacers before save and re-inserted them after via `onWillSaveNotebookDocument`/`onDidSaveNotebookDocument`, but the save cycle caused the cursor to jump to the last cell, race conditions, and visual flicker (see commits `3fbc1e5` and `0ab16d7`); it was replaced by persistence plus spacer detection on startup. Don't reintroduce save-time spacer removal without addressing those problems.

9. **Activation** — `activate()` registers 9 commands, subscribes to editor/selection change events (logging when VS Code clears the selection), and handles notebook close cleanup. On startup it refreshes the status bar and, if the active notebook already contains spacer cells (saved with slide view active), restores slide view state. `deactivate()` disposes the status bar and output channel and clears slide view state.

## Extension Manifest (package.json)

All 9 commands use the `jupyterSlideNav.*` namespace and `"Slide Navigator"` category. Navigation keybindings are scoped to `notebookEditorFocused || notebookOutputFocused` (so they also fire while the rendered slide output has focus); the overview/back keys add `&& !inputFocus` so they don't interfere while typing in a cell. `firstSlide`/`lastSlide` have commands but no default keybindings. Four user-facing settings live under `jupyterSlideNav.*` configuration.

## CI/CD

`.github/workflows/release.yml` — GitHub Actions workflow that triggers on tag pushes matching `v*`. It checks out the repo, installs dependencies, runs `npm run package` to build the `.vsix`, creates a GitHub release with the `.vsix` attached (`softprops/action-gh-release@v3`), and then publishes that same `.vsix` to the VS Code Marketplace (`@vscode/vsce`) and the Open VSX Registry (`ovsx`). The two publish steps are each gated on a repository secret — `VSCE_PAT` and `OVSX_TOKEN` respectively — and skip silently when their secret is absent. To cut a release: create an annotated tag (`git tag -a v0.x.y -m "..."`) and push it (`git push origin v0.x.y`).
