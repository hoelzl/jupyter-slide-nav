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
// Slide view state
// ---------------------------------------------------------------------------

/** Tracks which notebooks have slide view active (keyed by notebook URI string). */
const slideViewState = new Map<string, boolean>();

/**
 * Track notebooks that had slide view active at save time so we can
 * re-insert spacers after save completes.
 */
const slideViewPendingReinsert = new Set<string>();

/** Check if a cell is a spacer inserted by slide view. */
function isSpacerCell(cell: vscode.NotebookCell): boolean {
  const meta = cell.metadata as Record<string, unknown> | undefined;
  if (!meta) {
    return false;
  }
  const marker = meta["jupyterSlideNav"] as
    | Record<string, unknown>
    | undefined;
  return marker?.["spacer"] === true;
}

/** Create cell data for a spacer markdown cell. */
function createSpacerCellData(lines: number): vscode.NotebookCellData {
  // Use &nbsp; paragraphs instead of CSS height — VS Code's notebook virtual
  // scroller cannot estimate CSS-based cell heights, which causes all cells
  // after a CSS-sized spacer to become unreachable.
  const content = Array(lines).fill("&nbsp;").join("\n\n");
  const cellData = new vscode.NotebookCellData(
    vscode.NotebookCellKind.Markup,
    content,
    "markdown"
  );
  cellData.metadata = {
    jupyterSlideNav: { spacer: true },
    metadata: {
      slideshow: { slide_type: "skip" },
    },
  };
  return cellData;
}

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
    if (isSpacerCell(cell)) {
      continue;
    }
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

  const isSlideView = slideViewState.get(editor.notebook.uri.toString());
  const icon = isSlideView ? "$(telescope) $(layout) " : "$(telescope) ";
  bar.text = `${icon}Slide ${current.slideNumber}/${totalSlides}`;
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
// Slide view — insert / remove spacer cells
// ---------------------------------------------------------------------------

/**
 * Insert spacer cells before each slide boundary (except the first).
 * Processes from bottom to top so that earlier indices remain valid.
 */
async function insertSpacers(
  notebook: vscode.NotebookDocument
): Promise<void> {
  const config = vscode.workspace.getConfiguration("jupyterSlideNav");
  const lines = config.get<number>("slideViewSpacerLines", 40);
  const index = buildSlideIndex(notebook, SLIDE_TYPES, config);

  if (index.length <= 1) {
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  const insertions: vscode.NotebookEdit[] = [];

  // Skip the first slide — we only insert spacers *before* subsequent slides.
  for (let i = index.length - 1; i >= 1; i--) {
    const cellData = createSpacerCellData(lines);
    insertions.push(
      vscode.NotebookEdit.insertCells(index[i].cellIndex, [cellData])
    );
  }

  edit.set(notebook.uri, insertions);
  await vscode.workspace.applyEdit(edit);
}

/**
 * Remove all spacer cells from a notebook.
 * Processes from bottom to top so that earlier indices remain valid.
 */
async function removeSpacers(
  notebook: vscode.NotebookDocument
): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  const deletions: vscode.NotebookEdit[] = [];

  for (let i = notebook.cellCount - 1; i >= 0; i--) {
    if (isSpacerCell(notebook.cellAt(i))) {
      deletions.push(vscode.NotebookEdit.deleteCells(new vscode.NotebookRange(i, i + 1)));
    }
  }

  if (deletions.length === 0) {
    return;
  }

  edit.set(notebook.uri, deletions);
  await vscode.workspace.applyEdit(edit);
}

/** Toggle slide view for the active notebook. */
async function toggleSlideView(): Promise<void> {
  const editor = vscode.window.activeNotebookEditor;
  if (!editor) {
    return;
  }

  const uri = editor.notebook.uri.toString();
  const isActive = slideViewState.get(uri) ?? false;

  if (isActive) {
    await removeSpacers(editor.notebook);
    slideViewState.set(uri, false);
  } else {
    await insertSpacers(editor.notebook);
    slideViewState.set(uri, true);
    firstSlide();
  }

  // Refresh status bar to reflect the slide view icon change.
  refreshStatusBarForSelection(editor);
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
    vscode.commands.registerCommand("jupyterSlideNav.lastSlide", lastSlide),
    vscode.commands.registerCommand(
      "jupyterSlideNav.toggleSlideView",
      toggleSlideView
    )
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

  // Remove spacers before save so they never persist to disk.
  context.subscriptions.push(
    vscode.workspace.onWillSaveNotebookDocument((e) => {
      const uri = e.notebook.uri.toString();
      if (slideViewState.get(uri)) {
        slideViewPendingReinsert.add(uri);
        e.waitUntil(removeSpacers(e.notebook));
      }
    })
  );

  // Re-insert spacers after save completes.
  context.subscriptions.push(
    vscode.workspace.onDidSaveNotebookDocument((notebook) => {
      const uri = notebook.uri.toString();
      if (slideViewPendingReinsert.has(uri)) {
        slideViewPendingReinsert.delete(uri);
        insertSpacers(notebook);
      }
    })
  );

  // Clean up state when a notebook is closed.
  context.subscriptions.push(
    vscode.workspace.onDidCloseNotebookDocument((notebook) => {
      const uri = notebook.uri.toString();
      slideViewState.delete(uri);
      slideViewPendingReinsert.delete(uri);
    })
  );

  // If a notebook is already open when the extension activates, show status.
  if (vscode.window.activeNotebookEditor) {
    refreshStatusBarForSelection(vscode.window.activeNotebookEditor);
  }

  // Orphan cleanup: remove any spacer cells left from a previous session
  // (e.g., VS Code hot exit with slide view active).
  if (vscode.window.activeNotebookEditor) {
    const notebook = vscode.window.activeNotebookEditor.notebook;
    let hasOrphans = false;
    for (let i = 0; i < notebook.cellCount; i++) {
      if (isSpacerCell(notebook.cellAt(i))) {
        hasOrphans = true;
        break;
      }
    }
    if (hasOrphans) {
      removeSpacers(notebook);
    }
  }
}

export function deactivate(): void {
  statusBarItem?.dispose();
  statusBarItem = undefined;
  slideViewState.clear();
  slideViewPendingReinsert.clear();
}
