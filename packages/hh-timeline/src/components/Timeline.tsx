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

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw frame header
    drawFrameHeader(ctx, canvasWidth, scrollX);

    // Draw tracks
    tracks.forEach((track, trackIndex) => {
      const trackY = HEADER_HEIGHT + trackIndex * TRACK_HEIGHT;
      drawTrack(ctx, track, trackIndex, trackY, canvasWidth, scrollX);
    });

    // Draw current frame indicator
    drawCurrentFrameIndicator(ctx, currentFrame, canvasHeight, scrollX);
  }, [frameCount, currentFrame, tracks, scrollX]);

  // Draw frame number header
  const drawFrameHeader = (ctx: CanvasRenderingContext2D, canvasWidth: number, scrollX: number) => {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvasWidth, HEADER_HEIGHT);

    ctx.fillStyle = '#252525';
    ctx.fillRect(0, 0, TRACK_NAME_WIDTH, HEADER_HEIGHT);

    ctx.fillStyle = '#999';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startFrame = Math.floor(scrollX / CELL_WIDTH);
    const endFrame = Math.min(frameCount, startFrame + Math.ceil((canvasWidth - TRACK_NAME_WIDTH) / CELL_WIDTH) + 1);

    for (let frame = startFrame; frame < endFrame; frame++) {
      const x = TRACK_NAME_WIDTH + frame * CELL_WIDTH - scrollX;

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
    ctx.strokeRect(0, 0, canvasWidth, HEADER_HEIGHT);
  };

  // Draw a track
  const drawTrack = (
    ctx: CanvasRenderingContext2D,
    track: { id: string; name: string; layerId: string },
    trackIndex: number,
    trackY: number,
    canvasWidth: number,
    scrollX: number
  ) => {
    ctx.fillStyle = trackIndex % 2 === 0 ? '#252525' : '#2a2a2a';
    ctx.fillRect(0, trackY, TRACK_NAME_WIDTH, TRACK_HEIGHT);

    ctx.fillStyle = '#ccc';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(track.name, 8, trackY + TRACK_HEIGHT / 2);

    ctx.fillStyle = trackIndex % 2 === 0 ? '#1a1a1a' : '#1e1e1e';
    ctx.fillRect(TRACK_NAME_WIDTH, trackY, canvasWidth - TRACK_NAME_WIDTH, TRACK_HEIGHT);

    const startFrame = Math.floor(scrollX / CELL_WIDTH);
    const endFrame = Math.min(frameCount, startFrame + Math.ceil((canvasWidth - TRACK_NAME_WIDTH) / CELL_WIDTH) + 1);

    for (let frame = startFrame; frame < endFrame; frame++) {
      const cellX = TRACK_NAME_WIDTH + frame * CELL_WIDTH - scrollX;
      drawCell(ctx, cellX, trackY, frame === currentFrame);
    }

    ctx.strokeStyle = '#444';
    ctx.strokeRect(TRACK_NAME_WIDTH, trackY, canvasWidth - TRACK_NAME_WIDTH, TRACK_HEIGHT);
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
  const drawCurrentFrameIndicator = (ctx: CanvasRenderingContext2D, frame: number, canvasHeight: number, scrollX: number) => {
    const x = TRACK_NAME_WIDTH + (frame + 0.5) * CELL_WIDTH - scrollX;

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
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y < HEADER_HEIGHT && x > TRACK_NAME_WIDTH) {
      const frame = Math.floor((x - TRACK_NAME_WIDTH + scrollX) / CELL_WIDTH);
      if (frame >= 0 && frame < frameCount) {
        onCurrentFrameChange?.(frame);
      }
      return;
    }

    if (y > HEADER_HEIGHT && x > TRACK_NAME_WIDTH) {
      const trackIndex = Math.floor((y - HEADER_HEIGHT) / TRACK_HEIGHT);
      const frame = Math.floor((x - TRACK_NAME_WIDTH + scrollX) / CELL_WIDTH);

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
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      canvas.style.width = containerWidth + 'px';
      canvas.style.height = containerHeight + 'px';

      const dpr = window.devicePixelRatio || 1;
      canvas.width = containerWidth * dpr;
      canvas.height = containerHeight * dpr;

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
  }, [draw]);

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // Calculate total width for scrolling
  const totalWidth = TRACK_NAME_WIDTH + frameCount * CELL_WIDTH;
  const totalHeight = HEADER_HEIGHT + tracks.length * TRACK_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="hh-timeline"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      <div style={{ width: totalWidth, height: totalHeight, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          className="timeline-canvas"
          onClick={handleCanvasClick}
          style={{
            display: 'block',
            position: 'sticky',
            left: 0,
            top: 0,
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
};

export default Timeline;

