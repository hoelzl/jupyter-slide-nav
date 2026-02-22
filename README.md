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
- **Status bar indicator** — shows your current position (e.g. "Slide 12/47").

## Keybindings

| Command              | Windows / Linux           | macOS                     |
| -------------------- | ------------------------- | ------------------------- |
| Next Slide           | `Ctrl+Shift+PageDown`     | `Cmd+Shift+PageDown`      |
| Previous Slide       | `Ctrl+Shift+PageUp`       | `Cmd+Shift+PageUp`        |
| Next Fragment         | `Ctrl+Shift+Down`         | `Cmd+Shift+Down`          |
| Previous Fragment     | `Ctrl+Shift+Up`           | `Cmd+Shift+Up`            |
| First Slide          | `Ctrl+Shift+Home`         | `Cmd+Shift+Home`          |
| Last Slide           | `Ctrl+Shift+End`          | `Cmd+Shift+End`           |

All keybindings are active only when a notebook editor is focused.

## Configuration

| Setting                              | Default | Description                                              |
| ------------------------------------ | ------- | -------------------------------------------------------- |
| `jupyterSlideNav.includeSubslides`   | `true`  | Whether slide navigation stops at subslides too.         |
| `jupyterSlideNav.showStatusBar`      | `true`  | Show the slide position indicator in the status bar.     |
| `jupyterSlideNav.skipCellTypes`      | `[]`    | Slide types to skip (e.g. `["skip", "notes"]`).         |

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

### From VSIX

```bash
# Build the extension
npm install
npm run compile
npm run package

# Install the resulting .vsix file
code --install-extension jupyter-slide-nav-0.1.0.vsix
```

### For development

```bash
git clone <repo-url>
cd jupyter-slide-nav
npm install
```

Open the folder in VS Code, then press `F5` to compile and launch an Extension
Development Host with the extension loaded. Use `npm run watch` for automatic
recompilation during development.

## License

MIT
