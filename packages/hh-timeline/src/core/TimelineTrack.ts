import { TimelineConfig, TimelineCell, TimelineTrackData } from '../types';

export const DEFAULT_CONFIG: TimelineConfig = {
  fps: 30,
  defaultFrameCount: 120,
  cellWidth: 20,
  cellHeight: 30,
  titleTrackHeight: 40,
  iconWidth: 24
};

export const ICONWIDTH = 15;
export const ICONHEIGHT = 15;

/**
 * TimelineTrack - Represents a single track in the timeline
 */
export class TimelineTrack {
  protected config: TimelineConfig;
  protected data: TimelineTrackData;
  protected ctx: CanvasRenderingContext2D;
  protected elapsedTime: number = 0;

  // Visual properties
  protected cellBgStyle: string = '#d3d3d3'; // lightgray
  protected selectedCellBgStyle: string = '#00ffff'; // cyan
  protected cellStrokeStyle: string = '#000000'; // black
  protected stopFrameStyle: string = 'rgba(238, 147, 32, 0.8)';
  protected cellFontStyle: string = '#000000';
  protected cellFontSize: number = 10;
  protected trackNameSize: number = 12;

  // Icons and callbacks
  protected icons: Array<{ img: HTMLImageElement; onClick?: Function; onMouseMove?: Function }> = [];
  protected onNameClickedCallback?: Function;

  // Internal state
  protected canvasStartPos: number = 0;
  protected canvasEndPos: number = 0;

  constructor(
    data: TimelineTrackData,
    ctx: CanvasRenderingContext2D,
    config: TimelineConfig = DEFAULT_CONFIG
  ) {
    this.data = data;
    this.ctx = ctx;
    this.config = config;
  }

  getData(): TimelineTrackData {
    return this.data;
  }

  setElapsedTime(time: number): void {
    this.elapsedTime = time;
  }

  getSeqId(): number {
    return this.data.seqId;
  }

  getLayerId(): string {
    return this.data.layerId;
  }

  getName(): string {
    return this.data.name;
  }

  setName(name: string): void {
    this.data.name = name;
  }

  getCellHeight(): number {
    return this.data.height;
  }

  getCellWidth(): number {
    return this.config.cellWidth;
  }

  hasYOffset(offsetY: number): boolean {
    return offsetY >= this.data.yOffset && offsetY < this.data.yOffset + this.data.height;
  }

  /**
   * Calculate canvas X offset for a given frame
   */
  calculateCanvasOffsetX(frameId: number, includeTitle: boolean = true): number {
    const titleWidth = includeTitle ? this.getTitleWidth() : 0;
    return titleWidth + frameId * this.config.cellWidth;
  }

  getTitleWidth(): number {
    // Measure title text width + icon width
    this.ctx.font = `${this.trackNameSize}px sans-serif`;
    const textWidth = this.ctx.measureText(this.data.name).width;
    let iconWidth = 0;

    if (this.icons.length > 0) {
      iconWidth = this.icons.length * (this.config.iconWidth + 2);
    }

    return textWidth + iconWidth + 20; // padding
  }

  getTitleLength(): number {
    return this.getTitleWidth();
  }

  /**
   * Set icons for this track
   */
  setIcons(icons: Array<{ img: HTMLImageElement; onClick?: Function; onMouseMove?: Function }>): void {
    this.icons = icons;
  }

  /**
   * Set callback when name is clicked
   */
  setOnNameClickedCallback(callback: Function): void {
    this.onNameClickedCallback = callback;
  }

  /**
   * Get cell at frame position
   */
  getCellAtFrame(frameId: number): TimelineCell | null {
    return this.data.cells.find(
      cell => frameId >= cell.startFrame && frameId <= cell.endFrame
    ) || null;
  }

  /**
   * Get cell ID from canvas X offset
   */
  getCellIdFromOffset(offsetX: number): number {
    const titleWidth = this.getTitleWidth();
    if (offsetX < titleWidth) return -1;

    const relativeX = offsetX - titleWidth;
    const frameId = Math.floor(relativeX / this.config.cellWidth);

    if (frameId < 0 || frameId >= this.data.frameCount) return -1;

    return frameId;
  }

  /**
   * Select a cell
   */
  selectCell(frameId: number, addToSelection: boolean = false): void {
    if (!addToSelection) {
      this.clearSelection();
    }

    const cell = this.getCellAtFrame(frameId);
    if (cell) {
      cell.selected = true;
    }
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.data.cells.forEach(cell => cell.selected = false);
  }

  /**
   * Range select cells
   */
  rangeSelect(offsetX: number): void {
    const cellId = this.getCellIdFromOffset(offsetX);
    if (cellId < 0) return;

    const selectedCells = this.data.cells.filter(c => c.selected);
    if (selectedCells.length === 0) {
      this.selectCell(cellId);
      return;
    }

    // Find min and max selected frames
    let minFrame = Math.min(...selectedCells.map(c => c.startFrame));
    let maxFrame = Math.max(...selectedCells.map(c => c.endFrame));

    // Extend selection
    minFrame = Math.min(minFrame, cellId);
    maxFrame = Math.max(maxFrame, cellId);

    this.clearSelection();
    for (let i = minFrame; i <= maxFrame; i++) {
      this.selectCell(i, true);
    }
  }

  /**
   * Split selected cell
   */
  splitSelectedCell(): void {
    const selectedCells = this.data.cells.filter(c => c.selected);
    if (selectedCells.length !== 1) return;

    const cell = selectedCells[0];
    const duration = cell.endFrame - cell.startFrame + 1;
    if (duration <= 1) return; // Can't split single frame

    const midFrame = cell.startFrame + Math.floor(duration / 2);

    // Create two new cells
    const cell1: TimelineCell = {
      cellId: cell.cellId,
      startFrame: cell.startFrame,
      endFrame: midFrame - 1,
      selected: false
    };

    const cell2: TimelineCell = {
      cellId: this.data.cells.length,
      startFrame: midFrame,
      endFrame: cell.endFrame,
      selected: false
    };

    // Replace old cell with new cells
    const index = this.data.cells.indexOf(cell);
    this.data.cells.splice(index, 1, cell1, cell2);
  }

  /**
   * Merge selected cells
   */
  mergeSelectedCells(): void {
    const selectedCells = this.data.cells.filter(c => c.selected).sort((a, b) => a.startFrame - b.startFrame);
    if (selectedCells.length < 2) return;

    // Check if cells are continuous
    for (let i = 0; i < selectedCells.length - 1; i++) {
      if (selectedCells[i].endFrame + 1 !== selectedCells[i + 1].startFrame) {
        console.warn('Cannot merge non-continuous cells');
        return;
      }
    }

    // Create merged cell
    const mergedCell: TimelineCell = {
      cellId: selectedCells[0].cellId,
      startFrame: selectedCells[0].startFrame,
      endFrame: selectedCells[selectedCells.length - 1].endFrame,
      selected: true
    };

    // Remove old cells and add merged cell
    selectedCells.forEach(cell => {
      const index = this.data.cells.indexOf(cell);
      if (index >= 0) {
        this.data.cells.splice(index, 1);
      }
    });

    this.data.cells.push(mergedCell);
    this.data.cells.sort((a, b) => a.startFrame - b.startFrame);
  }

  /**
   * Draw the track on canvas
   */
  drawTrack(startX: number, endX: number, maxCellId: number = -1): void {
    this.canvasStartPos = startX;
    this.canvasEndPos = endX;

    const titleWidth = this.getTitleWidth();

    // Draw track background
    this.ctx.fillStyle = this.data.seqId % 2 === 0 ? '#2a2a2a' : '#252525';
    this.ctx.fillRect(0, this.data.yOffset, endX - startX, this.data.height);

    // Draw title
    this.drawTitle(titleWidth);

    // Draw cells
    const startFrame = Math.max(0, Math.floor((startX - titleWidth) / this.config.cellWidth) - 1);
    const endFrame = Math.min(this.data.frameCount - 1, Math.ceil((endX - titleWidth) / this.config.cellWidth) + 1);

    for (let frame = startFrame; frame <= endFrame; frame++) {
      this.drawCell(frame, maxCellId >= 0 && frame <= maxCellId);
    }

    // Draw max cell indicator (black vertical line)
    if (maxCellId >= 0 && maxCellId < this.data.frameCount) {
      const maxX = this.calculateCanvasOffsetX(maxCellId, true);
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 10;
      this.ctx.beginPath();
      this.ctx.moveTo(maxX, this.data.yOffset);
      this.ctx.lineTo(maxX, this.data.yOffset + this.data.height);
      this.ctx.stroke();
      this.ctx.lineWidth = 1;
    }

    // Draw timeline indicator (red playhead)
    this.drawTimelineIndicator();
  }

  /**
   * Draw track title with icons
   */
  private drawTitle(width: number): void {
    // Background
    this.ctx.fillStyle = '#1e1e1e';
    this.ctx.fillRect(0, this.data.yOffset, width, this.data.height);

    // Border
    this.ctx.strokeStyle = '#444';
    this.ctx.strokeRect(0, this.data.yOffset, width, this.data.height);

    let xOffset = 8;
    const yCenter = this.data.yOffset + this.data.height / 2;

    // Draw icons
    if (this.icons.length > 0) {
      for (const iconData of this.icons) {
        const iconY = yCenter - ICONHEIGHT / 2;
        this.ctx.drawImage(iconData.img, xOffset, iconY, ICONWIDTH, ICONHEIGHT);
        xOffset += ICONWIDTH + 2;
      }
      xOffset += 4;
    }

    // Draw selection checkbox if selected
    if (this.data.visible) {
      const checkSize = 12;
      const checkY = yCenter - checkSize / 2;

      this.ctx.fillStyle = '#4a90e2';
      this.ctx.fillRect(xOffset, checkY, checkSize, checkSize);
      this.ctx.strokeStyle = '#666';
      this.ctx.strokeRect(xOffset, checkY, checkSize, checkSize);

      // Draw checkmark
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(xOffset + 2, checkY + 6);
      this.ctx.lineTo(xOffset + 5, checkY + 9);
      this.ctx.lineTo(xOffset + 10, checkY + 3);
      this.ctx.stroke();
      this.ctx.lineWidth = 1;

      xOffset += checkSize + 8;
    }

    // Text
    this.ctx.fillStyle = '#e8e8e8';
    this.ctx.font = `${this.trackNameSize}px sans-serif`;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.data.name, xOffset, yCenter);
  }

  /**
   * Draw a single cell
   */
  drawCell(frameId: number, isActive: boolean): void {
    const x = this.calculateCanvasOffsetX(frameId, true);
    const y = this.data.yOffset;
    const width = this.config.cellWidth;
    const height = this.data.height;

    const cell = this.getCellAtFrame(frameId);

    // Cell background
    if (cell?.selected) {
      this.ctx.fillStyle = this.selectedCellBgStyle;
    } else if (isActive) {
      this.ctx.fillStyle = '#3a3a3a';
    } else {
      this.ctx.fillStyle = this.cellBgStyle;
    }
    this.ctx.fillRect(x, y, width, height);

    // Cell border
    this.ctx.strokeStyle = this.cellStrokeStyle;
    this.ctx.strokeRect(x, y, width, height);

    // Draw keyframe indicator (circle)
    const keyframeRadius = width / 4;
    const circleX = x + width / 2;
    const circleY = y + keyframeRadius;

    // For demo: mark every 5th frame as keyframe
    if (frameId % 5 === 0 && frameId > 0) {
      this.ctx.beginPath();
      this.ctx.arc(circleX, circleY, keyframeRadius, 0, 2 * Math.PI);
      this.ctx.strokeStyle = '#000';
      this.ctx.stroke();
    }

    // Draw stop frame indicator
    // For demo: mark every 10th frame as stop frame
    if (frameId % 10 === 0 && frameId > 0) {
      this.ctx.fillStyle = this.stopFrameStyle;
      this.ctx.fillRect(x, y, width, height);
    }

    // Cell number (every 5 frames)
    if (frameId % 5 === 0) {
      this.ctx.fillStyle = '#999';
      this.ctx.font = `${this.cellFontSize}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(frameId.toString(), x + width / 2, y + 2);
    }
  }

  /**
   * Draw timeline indicator (playhead)
   */
  drawTimelineIndicator(): void {
    const currentFrame = Math.floor(this.elapsedTime * this.config.fps);
    const x = this.calculateCanvasOffsetX(currentFrame, true);

    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, this.data.yOffset);
    this.ctx.lineTo(x, this.data.yOffset + this.data.height);
    this.ctx.stroke();
    this.ctx.lineWidth = 1;
  }

  /**
   * Handle mouse click on track
   */
  clickedTrack(offsetX: number, resetRangeSelect: boolean): number {
    const cellId = this.getCellIdFromOffset(offsetX);
    if (cellId < 0) return -1;

    if (resetRangeSelect) {
      this.selectCell(cellId);
    }

    return cellId;
  }

  /**
   * Handle mouse enter
   */
  onMouseEnter(offsetX: number): void {
    // Can be used for hover effects
  }

  /**
   * Handle mouse leave
   */
  onMouseLeave(): void {
    // Can be used to clear hover effects
  }

  /**
   * Handle mouse move
   */
  onMouseMove(offsetX: number): void {
    // Can be used for hover effects or drag operations
  }

  unSelectTrack(): void {
    this.clearSelection();
  }
}

/**
 * TitleTimelineTrack - Special track for displaying frame numbers
 */
export class TitleTimelineTrack extends TimelineTrack {
  constructor(
    seqId: number,
    frameCount: number,
    ctx: CanvasRenderingContext2D,
    yOffset: number,
    title: string = 'Frames',
    config: TimelineConfig = DEFAULT_CONFIG
  ) {
    const data: TimelineTrackData = {
      seqId,
      layerId: 'title',
      name: title,
      frameCount,
      cells: [],
      yOffset,
      height: config.titleTrackHeight,
      visible: true,
      locked: true
    };

    super(data, ctx, config);

    // Override styles for title track
    this.cellBgStyle = '#c0c0c0'; // silver
  }

  /**
   * Override drawTrack for title track
   */
  drawTrack(startX: number, endX: number): void {
    this.canvasStartPos = startX;
    this.canvasEndPos = endX;

    const titleWidth = this.getTitleWidth();
    const data = this.getData();

    // Draw title track background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, data.yOffset, endX - startX, data.height);

    // Draw title background
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(0, data.yOffset, titleWidth, data.height);

    // Draw title text
    this.ctx.fillStyle = '#e8e8e8';
    this.ctx.font = 'bold 14px sans-serif';
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      data.name,
      titleWidth / 2,
      data.yOffset + data.height / 2
    );

    // Draw frame grid and numbers
    const startFrame = Math.max(0, Math.floor((startX - titleWidth) / this.getCellWidth()) - 1);
    const endFrame = Math.min(data.frameCount - 1, Math.ceil((endX - titleWidth) / this.getCellWidth()) + 1);

    this.ctx.fillStyle = '#e8e8e8';
    this.ctx.font = '11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (let frame = startFrame; frame <= endFrame; frame++) {
      const x = this.calculateCanvasOffsetX(frame, true);

      // Draw vertical grid line every 5 frames
      if (frame % 5 === 0) {
        this.ctx.strokeStyle = frame % 10 === 0 ? '#666' : '#444';
        this.ctx.beginPath();
        this.ctx.moveTo(x, data.yOffset);
        this.ctx.lineTo(x, data.yOffset + data.height);
        this.ctx.stroke();

        // Frame number
        this.ctx.fillStyle = '#e8e8e8';
        this.ctx.fillText(
          frame.toString(),
          x + this.getCellWidth() * 2.5,
          data.yOffset + data.height / 2
        );
      }
    }

    // Draw timeline indicator
    this.drawTimelineIndicator();
  }
}

