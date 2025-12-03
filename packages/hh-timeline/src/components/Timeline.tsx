import React, { useRef, useEffect, useCallback, useState } from 'react';
import './Timeline.css';

export interface TimelineProps {
  frameCount: number;
  fps: number;
  currentFrame?: number;
  tracks?: Array<{
    id: string;
    name: string;
    layerId: string;
  }>;
  onCellClick?: (trackId: string, frameNumber: number) => void;
  onCurrentFrameChange?: (frame: number) => void;
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollX, setScrollX] = useState(0);

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

    // Draw current frame indicator
    drawCurrentFrameIndicator(ctx, currentFrame, totalHeight);
  }, [frameCount, currentFrame, tracks]);

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

    ctx.strokeStyle = '#444';
    ctx.strokeRect(0, 0, totalWidth, HEADER_HEIGHT);
  };

  // Draw a track
  const drawTrack = (
    ctx: CanvasRenderingContext2D,
    track: { id: string; name: string; layerId: string },
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

    // Draw all frames
    for (let frame = 0; frame < frameCount; frame++) {
      const cellX = TRACK_NAME_WIDTH + frame * CELL_WIDTH;
      drawCell(ctx, cellX, trackY, frame === currentFrame);
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

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

    if (y < HEADER_HEIGHT && x > TRACK_NAME_WIDTH) {
      const frame = Math.floor((x - TRACK_NAME_WIDTH) / CELL_WIDTH);
      if (frame >= 0 && frame < frameCount) {
        onCurrentFrameChange?.(frame);
      }
      return;
    }

    if (y > HEADER_HEIGHT && x > TRACK_NAME_WIDTH) {
      const trackIndex = Math.floor((y - HEADER_HEIGHT) / TRACK_HEIGHT);
      const frame = Math.floor((x - TRACK_NAME_WIDTH) / CELL_WIDTH);

      if (trackIndex >= 0 && trackIndex < tracks.length && frame >= 0 && frame < frameCount) {
        const track = tracks[trackIndex];
        onCellClick?.(track.id, frame);
      }
    }
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

  const MAX_HEIGHT_BEFORE_SCROLL = 200;
  const needsVerticalScroll = totalHeight > MAX_HEIGHT_BEFORE_SCROLL;

  return (
    <div
      ref={containerRef}
      className="hh-timeline"
      style={{
        width: '100%',
        height: needsVerticalScroll ? '100%' : `${totalHeight}px`,
        overflowX: 'auto',
        overflowY: needsVerticalScroll ? 'auto' : 'hidden',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      <div style={{
        width: totalWidth,
        minHeight: totalHeight,
        paddingBottom: '20px',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        <canvas
          ref={canvasRef}
          className="timeline-canvas"
          onClick={handleCanvasClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'auto',
            cursor: 'pointer',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};

export default Timeline;

