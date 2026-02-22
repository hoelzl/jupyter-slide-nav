# Jupyter Slide Navigator

A minimal VS Code extension for navigating Jupyter notebooks slide-by-slide
using the standard slideshow cell metadata (the same metadata used by RISE and
`nbconvert --to slides`).

## Features

- **Next / Previous Slide** — jump to the next or previous cell tagged as
  `slide` or `subslide`, scrolling it to the top of the editor.
- **Next / Previous Fragment** — finer-grained navigation that also stops at
  cells tagged as `fragment`.
- **First / Last Slide** — jump to the beginning or end of the deck.
- **Toggle Slide View** — insert spacer cells between slide boundaries so each
  slide fills roughly one viewport height, creating a "slide deck" feel. Each
  boundary gets a small sentinel cell (so Shift+Enter doesn't scroll the slide
  away) followed by a large spacer. Spacers are automatically removed before
  save and re-inserted after, so they never persist to disk.
- **Status bar indicator** — shows your current position (e.g. "Slide 12/47").
  Displays a layout icon when slide view is active.

## Keybindings

| Command              | Windows / Linux           | macOS                     |
| -------------------- | ------------------------- | ------------------------- |
| Next Slide           | `Ctrl+Shift+PageDown`     | `Cmd+Shift+PageDown`      |
| Previous Slide       | `Ctrl+Shift+PageUp`       | `Cmd+Shift+PageUp`        |
| Next Fragment         | `Ctrl+Shift+Down`         | `Cmd+Shift+Down`          |
| Previous Fragment     | `Ctrl+Shift+Up`           | `Cmd+Shift+Up`            |
| First Slide          | `Ctrl+Shift+Home`         | `Cmd+Shift+Home`          |
| Last Slide           | `Ctrl+Shift+End`          | `Cmd+Shift+End`           |
| Toggle Slide View    | `Ctrl+Shift+/`            | `Cmd+Shift+/`             |

All keybindings are active only when a notebook editor is focused.

## Configuration

| Setting                                 | Default  | Description                                              |
| --------------------------------------- | -------- | -------------------------------------------------------- |
| `jupyterSlideNav.includeSubslides`      | `true`   | Whether slide navigation stops at subslides too.         |
| `jupyterSlideNav.showStatusBar`         | `true`   | Show the slide position indicator in the status bar.     |
| `jupyterSlideNav.skipCellTypes`         | `[]`     | Slide types to skip (e.g. `["skip", "notes"]`).         |
| `jupyterSlideNav.slideViewSpacerLines`  | `40`     | Number of blank lines in spacer cells for slide view.    |

## Slide Metadata

The extension reads the standard Jupyter slideshow metadata from each cell:

```json
{
  "slideshow": {
    "slide_type": "slide"
  }
}
```

Valid `slide_type` values: `slide`, `subslide`, `fragment`, `skip`, `notes`, `-`.

You can set these tags using:
- The built-in Jupyter extension's "Slide Type" toolbar button
- The *Jupyter Slide Show* extension
- Any notebook editor that supports slideshow metadata
- Your own tooling (e.g. `clm`)

## Installation

### From GitHub Release

Download the latest `.vsix` from the
[Releases](https://github.com/hoelzl/jupyter-slide-nav/releases) page and
install it:

```bash
code --install-extension jupyter-slide-nav-0.2.2.vsix
```

Or using the GitHub CLI:

```bash
gh release download v0.2.2 --repo hoelzl/jupyter-slide-nav --pattern '*.vsix'
code --install-extension jupyter-slide-nav-0.2.2.vsix
```

### From Source

```bash
git clone https://github.com/hoelzl/jupyter-slide-nav.git
cd jupyter-slide-nav
npm install
npm run compile
npm run package
code --install-extension jupyter-slide-nav-0.2.2.vsix
```

### For Development

```bash
git clone https://github.com/hoelzl/jupyter-slide-nav.git
cd jupyter-slide-nav
npm install
```

Open the folder in VS Code, then press `F5` to compile and launch an Extension
Development Host with the extension loaded. Use `npm run watch` for automatic
recompilation during development.

## License

MIT
