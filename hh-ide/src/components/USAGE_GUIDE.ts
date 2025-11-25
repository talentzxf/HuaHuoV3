// FlexLayout - Quick Usage Guide

/**
 * DRAGGING TABS
 * =============
 * 1. Click and hold on a tab header
 * 2. Drag it to a new position
 * 3. Drop it when you see the drop indicator
 * 4. You can drag tabs to:
 *    - Reorder within the same tabset
 *    - Move to another tabset
 *    - Create new rows/columns
 *
 * RESIZING PANELS
 * ===============
 * 1. Hover over the splitter between two panels
 * 2. Click and drag the splitter to resize
 *
 * CLOSING TABS
 * ============
 * Click the X button on any tab to close it
 *
 * MAXIMIZING PANELS
 * =================
 * Click the maximize button to make a panel fullscreen
 * Click it again to restore
 *
 * SPLITTING TABSETS
 * =================
 * Drag a tab to the edge of another tabset to create a new split
 * - Drop at top/bottom edge: creates a row split
 * - Drop at left/right edge: creates a column split
 *
 * LAYOUT CONFIGURATION
 * ====================
 * The layout config in GoldenLayoutWrapper.tsx defines:
 * - Initial layout structure (row/column/tabset)
 * - Which components are visible
 * - Default sizes (weights)
 * - Global settings (drag speed, enable/disable features)
 */

// Example: Working with FlexLayout Model
/*
import { Actions } from 'flexlayout-react';

// Add a new tab programmatically
const addNewTab = () => {
  layoutRef.current?.addTabToTabSet('tabset_id', {
    type: 'tab',
    name: 'New Tab',
    component: 'myComponent',
  });
};

// Or use Actions
const onAddTab = (action: Action) => {
  if (action.type === Actions.ADD_NODE) {
    // Handle tab addition
  }
  return action;
};
*/

// Example: Save/Load layout state
/*
const saveLayout = () => {
  const json = model.toJson();
  localStorage.setItem('flexlayout', JSON.stringify(json));
};

const loadLayout = () => {
  const saved = localStorage.getItem('flexlayout');
  if (saved) {
    const json = JSON.parse(saved);
    const newModel = Model.fromJson(json);
    // Update state to use newModel
  }
};
*/

// FlexLayout Features:
// ✅ Drag and drop tabs
// ✅ Split panels horizontally/vertically
// ✅ Maximize/restore panels
// ✅ Close tabs
// ✅ Resize panels with splitters
// ✅ Persist layout to JSON
// ✅ Dark theme support
// ✅ Customizable via CSS

