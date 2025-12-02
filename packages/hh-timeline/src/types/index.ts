/**
 * Timeline types and interfaces
 */

export interface TimelineConfig {
  fps: number;
  defaultFrameCount: number;
  cellWidth: number;
  cellHeight: number;
  titleTrackHeight: number;
  iconWidth: number;
}

export interface TimelineCell {
  cellId: number;
  startFrame: number;
  endFrame: number;
  selected: boolean;
}

export interface TimelineTrackData {
  seqId: number;
  layerId: string;
  name: string;
  frameCount: number;
  cells: TimelineCell[];
  yOffset: number;
  height: number;
  visible: boolean;
  locked: boolean;
}

export interface TimelineState {
  frameCount: number;
  currentFrame: number;
  elapsedTime: number;
  tracks: TimelineTrackData[];
  selectedTrackId: string | null;
  selectedCells: number[];
  isSelectingRange: boolean;
}

export enum TimelineEventType {
  CELL_CLICKED = 'cellClicked',
  TRACK_SELECTED = 'trackSelected',
  CELLS_MERGED = 'cellsMerged',
  CELL_SPLIT = 'cellSplit',
  FRAME_CHANGED = 'frameChanged',
  TRACK_ADDED = 'trackAdded',
  TRACK_REMOVED = 'trackRemoved'
}

export interface TimelineEvent {
  type: TimelineEventType;
  payload?: any;
}

