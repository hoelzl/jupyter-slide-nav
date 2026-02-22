# Changelog

## 0.2.0

- Add Toggle Slide View command (`Ctrl+Shift+/`) — inserts vertical spacer cells between slide boundaries to create a "slide deck" feel with viewport-height spacing
- Spacer cells are automatically removed before save and re-inserted after, so they never persist to disk
- Orphan spacer cleanup on activation (handles VS Code hot exit)
- Status bar shows a layout icon when slide view is active
- New setting `jupyterSlideNav.slideViewSpacerHeight` (default `"85vh"`) to configure spacer height

## 0.1.0

- Initial release
- Next/previous slide navigation (slide + subslide)
- Next/previous fragment navigation (slide + subslide + fragment)
- First/last slide commands
- Status bar slide position indicator
- Configurable subslide inclusion, status bar visibility, and skip types
