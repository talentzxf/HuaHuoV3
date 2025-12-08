import React, { useRef, useEffect, useCallback, useState } from 'react';
import './Timeline.css';

export interface TimelineClip {
  id: string;
  startFrame: number;
  length: number;
}

export interface TimelineProps {
  frameCount: number;
  fps: number;
  currentFrame?: number;
  tracks?: Array<{
    id: string;
    name: string;
    clips?: TimelineClip[];
    keyFrames?: number[];
  }>;
  onCellClick?: (trackId: string, frameNumber: number) => void;
  onCurrentFrameChange?: (frame: number) => void;
  onMergeCells?: (trackId: string, startFrame: number, endFrame: number) => void;
  onSplitClip?: (trackId: string, clipId: string, splitFrame: number) => void;
}

interface CellSelection {
  trackId: string;
  startFrame: number;
  endFrame: number;
}

const CELL_WIDTH = 20;
const TRACK_HEIGHT = 30;
const HEADER_HEIGHT = 30;
const TRACK_NAME_WIDTH = 120;

export const Timeline: React.FC<TimelineProps> = ({
  frameCount,
  fps,
  currentFrame = 0,
  tracks = [],
  onCellClick,
  onCurrentFrameChange,
  onMergeCells,
  onSplitClip,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollX, setScrollX] = useState(0);

  // Selection state
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ trackId: string; frame: number } | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitContext, setSplitContext] = useState<{ trackId: string; clipId: string; frame: number } | null>(null);

  // Draw the timeline
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalWidth = TRACK_NAME_WIDTH + frameCount * CELL_WIDTH;
    const totalHeight = HEADER_HEIGHT + tracks.length * TRACK_HEIGHT;

    // Clear canvas
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Draw frame header
    drawFrameHeader(ctx, totalWidth);

    // Draw all tracks
    tracks.forEach((track, trackIndex) => {
      const trackY = HEADER_HEIGHT + trackIndex * TRACK_HEIGHT;
      drawTrack(ctx, track, trackIndex, trackY, totalWidth);
    });

    // Draw selection overlay
    if (selection) {
      drawSelection(ctx, selection);
    }

    // Draw current frame indicator
    drawCurrentFrameIndicator(ctx, currentFrame, totalHeight);
  }, [frameCount, currentFrame, tracks, selection]);

  // Draw frame number header
  const drawFrameHeader = (ctx: CanvasRenderingContext2D, totalWidth: number) => {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, totalWidth, HEADER_HEIGHT);

    ctx.fillStyle = '#252525';
    ctx.fillRect(0, 0, TRACK_NAME_WIDTH, HEADER_HEIGHT);

    ctx.fillStyle = '#999';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw all frames
    for (let frame = 0; frame < frameCount; frame++) {
      const x = TRACK_NAME_WIDTH + frame * CELL_WIDTH;

      if (frame % 5 === 0) {
        ctx.fillStyle = '#fff';
        ctx.fillText((frame + 1).toString(), x + CELL_WIDTH / 2, HEADER_HEIGHT / 2);
      }

      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEADER_HEIGHT);
      ctx.stroke();
    }

    // Draw project end marker at the last frame
    const endFrameX = TRACK_NAME_WIDTH + (frameCount - 1) * CELL_WIDTH + CELL_WIDTH;
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(endFrameX, 0);
    ctx.lineTo(endFrameX, HEADER_HEIGHT);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Draw "END" label
    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('END', endFrameX + 2, HEADER_HEIGHT / 2);

    ctx.strokeStyle = '#444';
    ctx.strokeRect(0, 0, totalWidth, HEADER_HEIGHT);
  };

  // Draw a track
  const drawTrack = (
    ctx: CanvasRenderingContext2D,
    track: { id: string; name: string; clips?: TimelineClip[]; keyFrames?: number[] },
    trackIndex: number,
    trackY: number,
    totalWidth: number
  ) => {
    ctx.fillStyle = trackIndex % 2 === 0 ? '#252525' : '#2a2a2a';
    ctx.fillRect(0, trackY, TRACK_NAME_WIDTH, TRACK_HEIGHT);

    ctx.fillStyle = '#ccc';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(track.name, 8, trackY + TRACK_HEIGHT / 2);

    ctx.fillStyle = trackIndex % 2 === 0 ? '#1a1a1a' : '#1e1e1e';
    ctx.fillRect(TRACK_NAME_WIDTH, trackY, totalWidth - TRACK_NAME_WIDTH, TRACK_HEIGHT);

    // Draw cell grid first (background)
    for (let frame = 0; frame < frameCount; frame++) {
      const cellX = TRACK_NAME_WIDTH + frame * CELL_WIDTH;

      // Draw cell border
      ctx.strokeStyle = '#333';
      ctx.strokeRect(cellX, trackY, CELL_WIDTH, TRACK_HEIGHT);

      // Highlight current frame
      if (frame === currentFrame) {
        ctx.fillStyle = 'rgba(64, 158, 255, 0.2)';
        ctx.fillRect(cellX, trackY, CELL_WIDTH, TRACK_HEIGHT);
      }
    }

    // Draw clips on top (large merged cells)
    if (track.clips && track.clips.length > 0) {
      track.clips.forEach(clip => {
        const clipX = TRACK_NAME_WIDTH + clip.startFrame * CELL_WIDTH;
        const clipWidth = clip.length * CELL_WIDTH;
        const clipEndFrame = clip.startFrame + clip.length - 1;

        // Draw clip as a large merged cell with gradient
        const gradient = ctx.createLinearGradient(clipX, trackY, clipX, trackY + TRACK_HEIGHT);
        gradient.addColorStop(0, '#73d13d');
        gradient.addColorStop(1, '#52c41a');
        ctx.fillStyle = gradient;
        ctx.fillRect(clipX + 1, trackY + 1, clipWidth - 2, TRACK_HEIGHT - 2);

        // Draw thick border around the merged cell
        ctx.strokeStyle = '#237804';
        ctx.lineWidth = 3;
        ctx.strokeRect(clipX + 1.5, trackY + 1.5, clipWidth - 3, TRACK_HEIGHT - 3);
        ctx.lineWidth = 1;

        // Draw frame separators inside clip (light lines)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        for (let frame = clip.startFrame + 1; frame <= clipEndFrame; frame++) {
          const lineX = TRACK_NAME_WIDTH + frame * CELL_WIDTH;
          ctx.beginPath();
          ctx.moveTo(lineX, trackY + 4);
          ctx.lineTo(lineX, trackY + TRACK_HEIGHT - 4);
          ctx.stroke();
        }

        // Draw clip label with frame range
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        const label = `${clip.startFrame}-${clipEndFrame}`;
        ctx.fillText(label, clipX + clipWidth / 2, trackY + TRACK_HEIGHT / 2);
        ctx.shadowBlur = 0;

        // Draw small frame numbers at start and end
        if (clipWidth > 60) {
          ctx.font = '9px Arial';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.textAlign = 'left';
          ctx.fillText(String(clip.startFrame), clipX + 4, trackY + TRACK_HEIGHT - 5);
          ctx.textAlign = 'right';
          ctx.fillText(String(clipEndFrame), clipX + clipWidth - 4, trackY + TRACK_HEIGHT - 5);
        }
      });
    }

    // Draw keyframe markers on top
    if (track.keyFrames && track.keyFrames.length > 0) {
      track.keyFrames.forEach(frame => {
        if (frame >= 0 && frame < frameCount) {
          const markerX = TRACK_NAME_WIDTH + frame * CELL_WIDTH;
          const markerCenterX = markerX + CELL_WIDTH / 2;
          const markerY = trackY + TRACK_HEIGHT - 4;

          // Draw diamond shape for keyframe marker
          ctx.fillStyle = '#ffa940';
          ctx.strokeStyle = '#fa8c16';
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.moveTo(markerCenterX, markerY - 5);        // Top
          ctx.lineTo(markerCenterX + 4, markerY);        // Right
          ctx.lineTo(markerCenterX, markerY + 5);        // Bottom
          ctx.lineTo(markerCenterX - 4, markerY);        // Left
          ctx.closePath();

          ctx.fill();
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      });
    }

    ctx.strokeStyle = '#444';
    ctx.strokeRect(TRACK_NAME_WIDTH, trackY, totalWidth - TRACK_NAME_WIDTH, TRACK_HEIGHT);
  };

  // Draw a single cell
  const drawCell = (ctx: CanvasRenderingContext2D, x: number, y: number, isCurrentFrame: boolean) => {
    if (isCurrentFrame) {
      ctx.fillStyle = 'rgba(64, 158, 255, 0.2)';
      ctx.fillRect(x, y, CELL_WIDTH, TRACK_HEIGHT);
    }

    ctx.strokeStyle = '#333';
    ctx.strokeRect(x, y, CELL_WIDTH, TRACK_HEIGHT);
  };

  // Draw current frame indicator (red line)
  const drawCurrentFrameIndicator = (ctx: CanvasRenderingContext2D, frame: number, canvasHeight: number) => {
    const x = TRACK_NAME_WIDTH + (frame + 0.5) * CELL_WIDTH;

    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, HEADER_HEIGHT);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = '#ff4d4f';
    ctx.beginPath();
    ctx.moveTo(x, HEADER_HEIGHT);
    ctx.lineTo(x - 5, HEADER_HEIGHT - 8);
    ctx.lineTo(x + 5, HEADER_HEIGHT - 8);
    ctx.closePath();
    ctx.fill();
  };

  // Draw selection overlay
  const drawSelection = (ctx: CanvasRenderingContext2D, sel: CellSelection) => {
    const trackIndex = tracks.findIndex(t => t.id === sel.trackId);
    if (trackIndex === -1) return;

    const trackY = HEADER_HEIGHT + trackIndex * TRACK_HEIGHT;
    const startX = TRACK_NAME_WIDTH + sel.startFrame * CELL_WIDTH;
    const width = (sel.endFrame - sel.startFrame + 1) * CELL_WIDTH;

    // Draw selection rectangle
    ctx.fillStyle = 'rgba(24, 144, 255, 0.3)';
    ctx.fillRect(startX, trackY, width, TRACK_HEIGHT);

    // Draw selection border
    ctx.strokeStyle = '#1890ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, trackY, width, TRACK_HEIGHT);
    ctx.lineWidth = 1;
  };

  // Get cell position from mouse coordinates
  const getCellFromPosition = (x: number, y: number): { trackId: string; frame: number } | null => {
    if (y < HEADER_HEIGHT || x < TRACK_NAME_WIDTH) return null;

    const trackIndex = Math.floor((y - HEADER_HEIGHT) / TRACK_HEIGHT);
    const frame = Math.floor((x - TRACK_NAME_WIDTH) / CELL_WIDTH);

    if (trackIndex >= 0 && trackIndex < tracks.length && frame >= 0 && frame < frameCount) {
      return { trackId: tracks[trackIndex].id, frame };
    }
    return null;
  };

  // Find clip at given track and frame
  const findClipAtFrame = (trackId: string, frame: number): TimelineClip | null => {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.clips) return null;

    return track.clips.find(clip => {
      const clipEnd = clip.startFrame + clip.length - 1;
      return frame >= clip.startFrame && frame <= clipEnd;
    }) || null;
  };

  // Handle mouse down - start selection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Click on header to change frame
    if (y < HEADER_HEIGHT && x > TRACK_NAME_WIDTH) {
      const frame = Math.floor((x - TRACK_NAME_WIDTH) / CELL_WIDTH);
      if (frame >= 0 && frame < frameCount) {
        onCurrentFrameChange?.(frame);
      }
      return;
    }

    // Start dragging selection
    const cell = getCellFromPosition(x, y);
    if (cell) {
      setIsDragging(true);
      setDragStart(cell);
      setSelection({
        trackId: cell.trackId,
        startFrame: cell.frame,
        endFrame: cell.frame
      });
    }
  };

  // Handle mouse move - update selection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cell = getCellFromPosition(x, y);
    if (cell && cell.trackId === dragStart.trackId) {
      setSelection({
        trackId: cell.trackId,
        startFrame: Math.min(dragStart.frame, cell.frame),
        endFrame: Math.max(dragStart.frame, cell.frame)
      });
    }
  };

  // Handle mouse up - complete selection
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);

      // If multiple cells selected, show merge dialog
      if (selection && selection.endFrame > selection.startFrame) {
        setShowMergeDialog(true);
      }
      // If single cell click, trigger onCellClick and clear selection
      else if (selection && selection.startFrame === selection.endFrame) {
        onCellClick?.(selection.trackId, selection.startFrame);
        setSelection(null);
      }
    }
  };

  // Handle right click - show split menu if inside clip
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cell = getCellFromPosition(x, y);
    if (!cell) return;

    // Check if right-clicked inside a clip
    const clip = findClipAtFrame(cell.trackId, cell.frame);

    if (clip) {
      // Check if click is not at the start edge (allow split only after first frame)
      const clipEnd = clip.startFrame + clip.length - 1;
      if (cell.frame > clip.startFrame && cell.frame <= clipEnd) {
        // Show split dialog
        setSplitContext({ trackId: cell.trackId, clipId: clip.id, frame: cell.frame });
        setShowSplitDialog(true);
      }
    }
  };

  // Handle merge confirmation
  const handleConfirmMerge = () => {
    if (!selection) return;

    onMergeCells?.(selection.trackId, selection.startFrame, selection.endFrame);

    setShowMergeDialog(false);
    setSelection(null);
  };

  // Handle merge cancellation
  const handleCancelMerge = () => {
    setShowMergeDialog(false);
    setSelection(null);
  };

  // Handle split confirmation
  const handleConfirmSplit = () => {
    if (!splitContext) return;

    onSplitClip?.(splitContext.trackId, splitContext.clipId, splitContext.frame);

    setShowSplitDialog(false);
    setSplitContext(null);
    setSelection(null);
  };

  // Handle split cancellation
  const handleCancelSplit = () => {
    setShowSplitDialog(false);
    setSplitContext(null);
    setSelection(null);
  };

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollX(target.scrollLeft);
  };

  // Setup canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const totalWidth = TRACK_NAME_WIDTH + frameCount * CELL_WIDTH;
      const totalHeight = HEADER_HEIGHT + tracks.length * TRACK_HEIGHT;

      canvas.style.width = totalWidth + 'px';
      canvas.style.height = totalHeight + 'px';

      const dpr = window.devicePixelRatio || 1;
      canvas.width = totalWidth * dpr;
      canvas.height = totalHeight * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      draw();
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [draw, tracks.length, frameCount]);

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // Calculate total width and height for scrolling
  const totalWidth = TRACK_NAME_WIDTH + frameCount * CELL_WIDTH;
  const totalHeight = HEADER_HEIGHT + tracks.length * TRACK_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="hh-timeline"
      style={{
        width: '100%',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      <div style={{
        width: totalWidth,
        height: totalHeight,
        position: 'relative',
      }}>
        <canvas
          ref={canvasRef}
          className="timeline-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'auto',
            cursor: isDragging ? 'grabbing' : 'pointer',
            display: 'block',
          }}
        />
        {showMergeDialog && selection && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCancelMerge();
              }
            }}
          >
            <div
              style={{
                background: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '20px',
                minWidth: '300px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                Merge Cells
              </div>
              <div style={{ color: '#ccc', fontSize: '14px', marginBottom: '20px' }}>
                Merge frames {selection.startFrame} to {selection.endFrame} ({selection.endFrame - selection.startFrame + 1} cells)?
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  style={{
                    padding: '8px 16px',
                    background: '#444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#555'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#444'}
                  onClick={handleCancelMerge}
                >
                  Cancel
                </button>
                <button
                  style={{
                    padding: '8px 16px',
                    background: '#1890ff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#40a9ff'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#1890ff'}
                  onClick={handleConfirmMerge}
                >
                  Merge
                </button>
              </div>
            </div>
          </div>
        )}
        {showSplitDialog && splitContext && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCancelSplit();
              }
            }}
          >
            <div
              style={{
                background: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '20px',
                minWidth: '300px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                Split Clip
              </div>
              <div style={{ color: '#ccc', fontSize: '14px', marginBottom: '20px' }}>
                Split clip at frame {splitContext.frame}?
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  style={{
                    padding: '8px 16px',
                    background: '#444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#555'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#444'}
                  onClick={handleCancelSplit}
                >
                  Cancel
                </button>
                <button
                  style={{
                    padding: '8px 16px',
                    background: '#ff4d4f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#ff7875'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ff4d4f'}
                  onClick={handleConfirmSplit}
                >
                  Split
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Timeline;

