# Changelog

## 0.3.1

- Fix navigation sporadically jumping back to the first slide: when VS Code clears the notebook selection (e.g. after the window loses focus or while a rendered output is focused), navigation now anchors on the first visible cell instead of treating the position as cell 0
- Add a "Slide Navigator" output channel (View → Output) that logs navigation commands, selection-loss events, and fallback decisions for diagnosing unexpected jumps

## 0.3.0

- Add **Go to Slide…** command (`Ctrl+Shift+O`) — a filterable overview of every slide; type part of a slide's title to jump straight to it
- Add **Go Back** command (`Ctrl+Shift+Backspace`) — returns to your previous position, for recovering from accidental jumps; backed by per-notebook navigation history
- Slide and fragment navigation now also fire while a cell is in edit mode or the rendered slide output is focused (`when` broadened to `notebookEditorFocused || notebookOutputFocused`)
- Remove the accident-prone `Ctrl+Shift+Home` / `Ctrl+Shift+End` keybindings for First/Last Slide; the commands remain available from the Command Palette
- Publish releases to the Open VSX Registry via CI (requires the `OVSX_TOKEN` secret)

## 0.2.3

- Let spacer cells persist to disk and fix detection after reload
- Fix save in slide view jumping to last cell and breaking display

## 0.2.2

- Add sentinel cell before each spacer so Shift+Enter doesn't scroll the current slide off-screen
- Fix spacer cells breaking notebook virtual scroller (use content-based spacing instead of CSS `min-height: 85vh`)
- Fix `insertSpacers` only inserting one spacer cell (`WorkspaceEdit.set()` replaces, not appends)
- Rename setting `slideViewSpacerHeight` → `slideViewSpacerLines` (integer, default `40`)

## 0.2.0

- Add Toggle Slide View command (`Ctrl+Shift+/`) — inserts vertical spacer cells between slide boundaries to create a "slide deck" feel with viewport-height spacing
- Spacer cells are automatically removed before save and re-inserted after, so they never persist to disk
- Orphan spacer cleanup on activation (handles VS Code hot exit)
- Status bar shows a layout icon when slide view is active
- New setting `jupyterSlideNav.slideViewSpacerLines` (default `40`) to configure spacer height

## 0.1.0

- Initial release
- Next/previous slide navigation (slide + subslide)
- Next/previous fragment navigation (slide + subslide + fragment)
- First/last slide commands
- Status bar slide position indicator
- Configurable subslide inclusion, status bar visibility, and skip types
