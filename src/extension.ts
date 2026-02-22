import * as vscode from "vscode";

/** Jupyter slideshow metadata types. */
type SlideType = "slide" | "subslide" | "fragment" | "skip" | "notes" | "-";

/** Which slide types count as navigation targets for slide-level commands. */
const SLIDE_TYPES: ReadonlySet<SlideType> = new Set(["slide", "subslide"]);

/** Which slide types count as navigation targets for fragment-level commands. */
const FRAGMENT_TYPES: ReadonlySet<SlideType> = new Set([
  "slide",
  "subslide",
  "fragment",
]);

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

/**
 * Extract the slide_type from a notebook cell's metadata.
 *
 * VS Code's built-in `vscode.ipynb` deserializer wraps Jupyter cell metadata
 * under an extra `metadata` key, so the actual path is:
 *   cell.metadata.metadata.slideshow.slide_type
 *
 * We check multiple paths for compatibility with different VS Code versions
 * and non-standard notebook formats.
 */
function getSlideType(cell: vscode.NotebookCell): SlideType | undefined {
  const meta = cell.metadata as Record<string, unknown> | undefined;
  if (!meta) {
    return undefined;
  }

  // Modern VS Code: vscode.ipynb nests Jupyter metadata under "metadata"
  const innerMeta = meta["metadata"] as Record<string, unknown> | undefined;
  if (innerMeta) {
    const slideshow = innerMeta["slideshow"] as
      | Record<string, unknown>
      | undefined;
    if (slideshow && typeof slideshow["slide_type"] === "string") {
      return slideshow["slide_type"] as SlideType;
    }
  }

  // Legacy VS Code: older versions used a "custom" wrapper
  const custom = meta["custom"] as Record<string, unknown> | undefined;
  if (custom) {
    const customMeta = custom["metadata"] as
      | Record<string, unknown>
      | undefined;
    if (customMeta) {
      const slideshow = customMeta["slideshow"] as
        | Record<string, unknown>
        | undefined;
      if (slideshow && typeof slideshow["slide_type"] === "string") {
        return slideshow["slide_type"] as SlideType;
      }
    }
  }

  // Direct path (forward compatibility / non-standard formats)
  const slideshow = meta["slideshow"] as
    | Record<string, unknown>
    | undefined;
  if (slideshow && typeof slideshow["slide_type"] === "string") {
    return slideshow["slide_type"] as SlideType;
  }

  // Flattened (some exporters)
  if (typeof meta["slide_type"] === "string") {
    return meta["slide_type"] as SlideType;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

interface SlideIndex {
  /** Cell index in the notebook. */
  cellIndex: number;
  /** The 1-based slide number (counting only slide/subslide cells). */
  slideNumber: number;
}

/**
 * Build an ordered list of slide positions in the notebook.
 *
 * @param notebook  The notebook document.
 * @param targets   Which slide types to consider as navigation stops.
 * @param config    Extension configuration.
 * @returns Array of SlideIndex entries.
 */
function buildSlideIndex(
  notebook: vscode.NotebookDocument,
  targets: ReadonlySet<SlideType>,
  config: vscode.WorkspaceConfiguration
): SlideIndex[] {
  const skipTypes = new Set(
    config.get<string[]>("skipCellTypes", []) as SlideType[]
  );
  const includeSubslides = config.get<boolean>("includeSubslides", true);

  const index: SlideIndex[] = [];
  let slideNumber = 0;

  for (let i = 0; i < notebook.cellCount; i++) {
    const cell = notebook.cellAt(i);
    const slideType = getSlideType(cell);

    if (!slideType || slideType === "-") {
      continue;
    }
    if (skipTypes.has(slideType)) {
      continue;
    }

    // For slide-level navigation, optionally exclude subslides.
    if (targets === SLIDE_TYPES && !includeSubslides && slideType === "subslide") {
      continue;
    }

    if (targets.has(slideType)) {
      if (slideType === "slide" || slideType === "subslide") {
        slideNumber++;
      }
      index.push({ cellIndex: i, slideNumber: slideNumber || 1 });
    }
  }

  return index;
}

/**
 * Navigate to a specific cell, scrolling it to the top of the editor.
 */
function navigateToCell(
  editor: vscode.NotebookEditor,
  cellIndex: number
): void {
  const range = new vscode.NotebookRange(cellIndex, cellIndex + 1);

  // Move selection to the target cell.
  editor.selections = [range];

  // Reveal with the cell at the top of the viewport.
  editor.revealRange(range, vscode.NotebookEditorRevealType.AtTop);
}

/**
 * Get the index of the currently focused cell.
 */
function getCurrentCellIndex(editor: vscode.NotebookEditor): number {
  if (editor.selections.length > 0) {
    return editor.selections[0].start;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function nextSlide(targets: ReadonlySet<SlideType>): void {
  const editor = vscode.window.activeNotebookEditor;
  if (!editor) {
    return;
  }

  const config = vscode.workspace.getConfiguration("jupyterSlideNav");
  const index = buildSlideIndex(editor.notebook, targets, config);
  if (index.length === 0) {
    vscode.window.showInformationMessage(
      "No slide metadata found in this notebook."
    );
    return;
  }

  const current = getCurrentCellIndex(editor);
  const next = index.find((s) => s.cellIndex > current);

  if (next) {
    navigateToCell(editor, next.cellIndex);
    updateStatusBar(editor, index, next);
  } else {
    vscode.window.showInformationMessage("Already at the last slide.");
  }
}

function prevSlide(targets: ReadonlySet<SlideType>): void {
  const editor = vscode.window.activeNotebookEditor;
  if (!editor) {
    return;
  }

  const config = vscode.workspace.getConfiguration("jupyterSlideNav");
  const index = buildSlideIndex(editor.notebook, targets, config);
  if (index.length === 0) {
    vscode.window.showInformationMessage(
      "No slide metadata found in this notebook."
    );
    return;
  }

  const current = getCurrentCellIndex(editor);

  // Find the last slide entry that is strictly before the current cell.
  let prev: SlideIndex | undefined;
  for (let i = index.length - 1; i >= 0; i--) {
    if (index[i].cellIndex < current) {
      prev = index[i];
      break;
    }
  }

  if (prev) {
    navigateToCell(editor, prev.cellIndex);
    updateStatusBar(editor, index, prev);
  } else {
    vscode.window.showInformationMessage("Already at the first slide.");
  }
}

function firstSlide(): void {
  const editor = vscode.window.activeNotebookEditor;
  if (!editor) {
    return;
  }

  const config = vscode.workspace.getConfiguration("jupyterSlideNav");
  const index = buildSlideIndex(editor.notebook, SLIDE_TYPES, config);
  if (index.length === 0) {
    vscode.window.showInformationMessage(
      "No slide metadata found in this notebook."
    );
    return;
  }

  const first = index[0];
  navigateToCell(editor, first.cellIndex);
  updateStatusBar(editor, index, first);
}

function lastSlide(): void {
  const editor = vscode.window.activeNotebookEditor;
  if (!editor) {
    return;
  }

  const config = vscode.workspace.getConfiguration("jupyterSlideNav");
  const index = buildSlideIndex(editor.notebook, SLIDE_TYPES, config);
  if (index.length === 0) {
    vscode.window.showInformationMessage(
      "No slide metadata found in this notebook."
    );
    return;
  }

  const last = index[index.length - 1];
  navigateToCell(editor, last.cellIndex);
  updateStatusBar(editor, index, last);
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

let statusBarItem: vscode.StatusBarItem | undefined;

function ensureStatusBar(): vscode.StatusBarItem {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.name = "Slide Navigator";
    statusBarItem.command = "jupyterSlideNav.nextSlide";
    statusBarItem.tooltip = "Click to go to next slide (Ctrl+Shift+PageDown)";
  }
  return statusBarItem;
}

function updateStatusBar(
  editor: vscode.NotebookEditor,
  index: SlideIndex[],
  current: SlideIndex
): void {
  const config = vscode.workspace.getConfiguration("jupyterSlideNav");
  if (!config.get<boolean>("showStatusBar", true)) {
    statusBarItem?.hide();
    return;
  }

  const bar = ensureStatusBar();

  // Count total slides (only slide/subslide, not fragments).
  const totalSlides = index.filter(
    (s) =>
      getSlideType(editor.notebook.cellAt(s.cellIndex)) === "slide" ||
      getSlideType(editor.notebook.cellAt(s.cellIndex)) === "subslide"
  ).length;

  bar.text = `$(telescope) Slide ${current.slideNumber}/${totalSlides}`;
  bar.show();
}

/**
 * Refresh status bar based on current selection — called when the user
 * navigates manually (clicking cells, arrow keys, etc.).
 */
function refreshStatusBarForSelection(editor: vscode.NotebookEditor): void {
  const config = vscode.workspace.getConfiguration("jupyterSlideNav");
  if (!config.get<boolean>("showStatusBar", true)) {
    statusBarItem?.hide();
    return;
  }

  const index = buildSlideIndex(editor.notebook, SLIDE_TYPES, config);
  if (index.length === 0) {
    statusBarItem?.hide();
    return;
  }

  const current = getCurrentCellIndex(editor);

  // Find the slide we're currently on or just after.
  let activeSlide: SlideIndex | undefined;
  for (let i = index.length - 1; i >= 0; i--) {
    if (index[i].cellIndex <= current) {
      activeSlide = index[i];
      break;
    }
  }

  if (activeSlide) {
    updateStatusBar(editor, index, activeSlide);
  }
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("jupyterSlideNav.nextSlide", () =>
      nextSlide(SLIDE_TYPES)
    ),
    vscode.commands.registerCommand("jupyterSlideNav.prevSlide", () =>
      prevSlide(SLIDE_TYPES)
    ),
    vscode.commands.registerCommand("jupyterSlideNav.nextFragment", () =>
      nextSlide(FRAGMENT_TYPES)
    ),
    vscode.commands.registerCommand("jupyterSlideNav.prevFragment", () =>
      prevSlide(FRAGMENT_TYPES)
    ),
    vscode.commands.registerCommand("jupyterSlideNav.firstSlide", firstSlide),
    vscode.commands.registerCommand("jupyterSlideNav.lastSlide", lastSlide)
  );

  // Update status bar when the active notebook editor or selection changes.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveNotebookEditor((editor) => {
      if (editor) {
        refreshStatusBarForSelection(editor);
      } else {
        statusBarItem?.hide();
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeNotebookEditorSelection((e) => {
      refreshStatusBarForSelection(e.notebookEditor);
    })
  );

  // If a notebook is already open when the extension activates, show status.
  if (vscode.window.activeNotebookEditor) {
    refreshStatusBarForSelection(vscode.window.activeNotebookEditor);
  }
}

export function deactivate(): void {
  statusBarItem?.dispose();
  statusBarItem = undefined;
}
