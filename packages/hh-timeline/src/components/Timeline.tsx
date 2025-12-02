import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TimelineTrack, TitleTimelineTrack, DEFAULT_CONFIG } from '../core/TimelineTrack';
import { TimelineConfig, TimelineTrackData, TimelineEventType } from '../types';
import './Timeline.css';

export interface TimelineProps {
  frameCount?: number;
  fps?: number;
  elapsedTime?: number;
  layers?: Array<{ id: string; name: string; frameCount: number }>;
  onCellClick?: (layerId: string, cellId: number) => void;
  onFrameChange?: (frame: number) => void;
  onTrackSelect?: (layerId: string) => void;
  config?: Partial<TimelineConfig>;
}

export const Timeline: React.FC<TimelineProps> = ({
  frameCount = DEFAULT_CONFIG.defaultFrameCount,
  fps = DEFAULT_CONFIG.fps,
  elapsedTime = 0,
  layers = [],
  onCellClick,
  onFrameChange,
  onTrackSelect,
  config: configOverride = {}
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [tracks, setTracks] = useState<TimelineTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [mouseOverTrackSeqId, setMouseOverTrackSeqId] = useState(-1);

  const config: TimelineConfig = { ...DEFAULT_CONFIG, ...configOverride, fps };

  // Calculate total height
  const totalHeight = tracks.reduce((sum, track) => sum + track.getCellHeight(), 0);

  // Initialize tracks when layers change
  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const newTracks: TimelineTrack[] = [];
    let yOffset = 0;

    // Add title track
    const titleTrack = new TitleTimelineTrack(
      0,
      frameCount,
      ctx,
      yOffset,
      'Frames',
      config
    );
    newTracks.push(titleTrack);
    yOffset += titleTrack.getCellHeight();

    // Add layer tracks
    layers.forEach((layer, index) => {
      const trackData: TimelineTrackData = {
        seqId: index + 1,
        layerId: layer.id,
        name: layer.name,
        frameCount: layer.frameCount || frameCount,
        cells: [],
        yOffset,
        height: config.cellHeight,
        visible: true,
        locked: false
      };

      // Initialize cells (one cell per frame for now)
      for (let i = 0; i < trackData.frameCount; i++) {
        trackData.cells.push({
          cellId: i,
          startFrame: i,
          endFrame: i,
          selected: false
        });
      }

      const track = new TimelineTrack(trackData, ctx, config);
      track.setElapsedTime(elapsedTime);
      newTracks.push(track);
      yOffset += track.getCellHeight();
    });

    setTracks(newTracks);
  }, [layers, frameCount, config]);

  // Update elapsed time
  useEffect(() => {
    tracks.forEach(track => track.setElapsedTime(elapsedTime));
    redrawCanvas();
  }, [elapsedTime, tracks]);

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current || !scrollContainerRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const canvasWidth = canvasRef.current.width;
    const canvasHeight = canvasRef.current.height;

    // Clear background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Calculate max track name length
    let maxTrackNameLength = 0;
    tracks.forEach(track => {
      maxTrackNameLength = Math.max(maxTrackNameLength, track.getTitleLength());
    });

    const startX = scrollLeft - maxTrackNameLength;
    const endX = scrollLeft + canvasWidth;

    // Draw all tracks
    tracks.forEach(track => {
      track.drawTrack(startX, endX, frameCount - 1);
    });

    // Position canvas relative to scroll
    canvasRef.current.style.left = `${scrollLeft}px`;
  }, [tracks, frameCount]);


  // Handle scroll
  const handleScroll = useCallback(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Calculate track seq ID from Y position
  const calculateTrackSeqId = useCallback((offsetY: number): number => {
    for (const track of tracks) {
      if (track.hasYOffset(offsetY)) {
        return track.getSeqId();
      }
    }
    return -1;
  }, [tracks]);

  // Handle mouse down
  const handleMouseDown = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
    if (evt.button === 0 || evt.button === 2) {
      const trackSeqId = calculateTrackSeqId(evt.nativeEvent.offsetY);
      if (trackSeqId < 0 || trackSeqId >= tracks.length) return;

      const track = tracks[trackSeqId];
      const shiftPressed = evt.shiftKey;

      // Clear previous selection if different track
      if (selectedTrackId && selectedTrackId !== track.getLayerId()) {
        const prevTrack = tracks.find(t => t.getLayerId() === selectedTrackId);
        prevTrack?.clearSelection();
      }

      if (!shiftPressed || !selectedTrackId) {
        const cellId = track.clickedTrack(evt.nativeEvent.offsetX, evt.button !== 2);
        if (cellId >= 0) {
          setSelectedTrackId(track.getLayerId());
          onTrackSelect?.(track.getLayerId());
          onCellClick?.(track.getLayerId(), cellId);
        }
      } else {
        if (track.getLayerId() === selectedTrackId) {
          track.rangeSelect(evt.nativeEvent.offsetX);
        } else {
          const cellId = track.clickedTrack(evt.nativeEvent.offsetX, evt.button !== 2);
          if (cellId >= 0) {
            setSelectedTrackId(track.getLayerId());
            onTrackSelect?.(track.getLayerId());
            onCellClick?.(track.getLayerId(), cellId);
          }
        }
      }

      setIsSelectingRange(true);
      redrawCanvas();
    }
  }, [tracks, selectedTrackId, calculateTrackSeqId, onCellClick, onTrackSelect, redrawCanvas]);

  // Handle mouse move
  const handleMouseMove = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
    const trackSeqId = calculateTrackSeqId(evt.nativeEvent.offsetY);

    // Handle mouse enter/leave for tracks
    if (trackSeqId >= 0 && trackSeqId < tracks.length) {
      if (mouseOverTrackSeqId !== trackSeqId) {
        tracks[trackSeqId].onMouseEnter(evt.nativeEvent.offsetX);
      }
      tracks[trackSeqId].onMouseMove(evt.nativeEvent.offsetX);
    }

    if (mouseOverTrackSeqId >= 0 && mouseOverTrackSeqId !== trackSeqId && mouseOverTrackSeqId < tracks.length) {
      tracks[mouseOverTrackSeqId].onMouseLeave();
    }
    setMouseOverTrackSeqId(trackSeqId);

    // Range selection
    if (evt.buttons === 1 && isSelectingRange) {
      const selectedTrack = tracks.find(t => t.getLayerId() === selectedTrackId);
      if (selectedTrack && trackSeqId === selectedTrack.getSeqId()) {
        selectedTrack.rangeSelect(evt.nativeEvent.offsetX);
        redrawCanvas();
      }
    } else {
      setIsSelectingRange(false);
    }
  }, [tracks, mouseOverTrackSeqId, isSelectingRange, selectedTrackId, calculateTrackSeqId, redrawCanvas]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsSelectingRange(false);
  }, []);

  // Handle mouse enter
  const handleMouseEnter = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
    const trackSeqId = calculateTrackSeqId(evt.nativeEvent.offsetY);
    if (trackSeqId >= 0 && trackSeqId < tracks.length) {
      tracks[trackSeqId].onMouseEnter(evt.nativeEvent.offsetX);
    }
    setMouseOverTrackSeqId(trackSeqId);
  }, [tracks, calculateTrackSeqId]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (mouseOverTrackSeqId >= 0 && mouseOverTrackSeqId < tracks.length) {
      tracks[mouseOverTrackSeqId].onMouseLeave();
    }
    setMouseOverTrackSeqId(-1);
  }, [tracks, mouseOverTrackSeqId]);

  // Initialize canvas size once
  useEffect(() => {
    if (!canvasRef.current || !scrollContainerRef.current || !containerRef.current) return;

    // Set container size
    const widthPixel = frameCount * config.cellWidth;
    const heightPixel = totalHeight;
    containerRef.current.style.width = `${widthPixel}px`;
    containerRef.current.style.height = `${heightPixel}px`;

    // Set canvas size
    canvasRef.current.width = scrollContainerRef.current.clientWidth;
    canvasRef.current.height = scrollContainerRef.current.clientHeight;

    // Initial draw
    redrawCanvas();
  }, [frameCount, config.cellWidth, totalHeight, tracks, redrawCanvas]);

  // Public methods for external control
  useEffect(() => {
    // Expose methods to parent if needed
    const timelineAPI = {
      mergeCells: () => {
        const selectedTrack = tracks.find(t => t.getLayerId() === selectedTrackId);
        selectedTrack?.mergeSelectedCells();
        redrawCanvas();
      },
      splitCell: () => {
        const selectedTrack = tracks.find(t => t.getLayerId() === selectedTrackId);
        selectedTrack?.splitSelectedCell();
        redrawCanvas();
      },
      selectLayer: (layerId: string) => {
        const track = tracks.find(t => t.getLayerId() === layerId);
        if (track) {
          setSelectedTrackId(layerId);
          onTrackSelect?.(layerId);
        }
      }
    };

    // Could expose via ref if needed
  }, [tracks, selectedTrackId, redrawCanvas, onTrackSelect]);

  return (
    <div className="hh-timeline">
      <div
        ref={scrollContainerRef}
        className="timeline-scroll-container"
        onScroll={handleScroll}
      >
        <div ref={containerRef} className="timeline-container">
          <canvas
            ref={canvasRef}
            className="timeline-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>
    </div>
  );
};

export default Timeline;

