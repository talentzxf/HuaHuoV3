import React, { useState, useEffect, useRef } from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Timeline } from '@huahuo/timeline';
import { getEngineStore, getEngineState, setAnimationEndFrame } from '@huahuo/engine';
import { addTimelineClip, splitTimelineClip, setCurrentFrame } from '@huahuo/engine';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';

/**
 * TimelinePanel - Integrates the Timeline component with the engine
 * Acts as an adapter layer between Engine and Timeline component
 * Keeps the Timeline component independent from Engine concepts
 */
const TimelinePanel: React.FC = () => {
  const [tracks, setTracks] = useState<Array<{
    id: string;
    name: string;
    clips?: Array<{ id: string; startFrame: number; length: number }>;
    keyFrames?: number[];
  }>>([]);
  const [currentFrame, setCurrentFrameState] = useState(0);
  const [timelineHeight, setTimelineHeight] = useState<number | undefined>(undefined);

  // Get project totalFrames and fps from Redux
  const totalFrames = useSelector((state: RootState) => state.engine.project.current?.totalFrames || 120);
  const fps = useSelector((state: RootState) => state.engine.project.current?.fps || 30);
  const animationEndFrame = useSelector((state: RootState) => state.engine.project.current?.animationEndFrame ?? null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    frameNumber: number;
  } | null>(null);

  // Internal mapping: Timeline trackId (generated UUID) -> Engine layerId
  const trackToLayerMap = useRef<Map<string, string>>(new Map());

  // Load layers from engine and map to timeline tracks
  useEffect(() => {
    const engineStore = getEngineStore();

    const updateTracks = () => {
      const state = engineStore.getState();
      const engineState = state.engine || state;

      // Update current frame from playback state
      setCurrentFrameState(engineState.playback.currentFrame);

      // Clear previous mapping
      trackToLayerMap.current.clear();

      // Map engine layers to simple track data
      const trackList = Object.values(engineState.layers.byId)
        .filter((layer: any) => layer.hasTimeline)
        .map((layer: any) => {
          // Store internal mapping for callbacks
          trackToLayerMap.current.set(layer.id, layer.id);

          // Return clean track data with clips
          return {
            id: layer.id,
            name: layer.name,
            clips: layer.clips || [],
            keyFrames: layer.keyFrames ? layer.keyFrames.map((kf: any) => kf.frame) : []
          };
        });

      setTracks(trackList);

      // Calculate timeline height including scrollbar space
      const HEADER_HEIGHT = 30;
      const TRACK_HEIGHT = 30;
      const SCROLLBAR_HEIGHT = 20;
      const calculatedHeight = HEADER_HEIGHT + trackList.length * TRACK_HEIGHT + SCROLLBAR_HEIGHT;
      const minHeight = 50;
      const MAX_HEIGHT_BEFORE_SCROLL = 200;

      // If content is small, use calculated height; otherwise let it use 100%
      if (calculatedHeight <= MAX_HEIGHT_BEFORE_SCROLL) {
        setTimelineHeight(Math.max(minHeight, calculatedHeight));
      } else {
        setTimelineHeight(undefined); // Use 100%
      }
    };

    updateTracks();

    // Selector: only subscribe to layers and playback changes
    let previousLayers: any;
    let previousCurrentFrame: number;

    const selector = (state: any) => {
      const engineState = state.engine || state;
      return {
        layers: engineState.layers,
        currentFrame: engineState.playback.currentFrame
      };
    };

    const unsubscribe = engineStore.subscribe(() => {
      const selected = selector(engineStore.getState());

      // Only update if selected state changed
      if (selected.layers !== previousLayers || selected.currentFrame !== previousCurrentFrame) {
        previousLayers = selected.layers;
        previousCurrentFrame = selected.currentFrame;
        updateTracks();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCellClick = (trackId: string, frameNumber: number) => {
    console.log('Cell clicked:', trackId, frameNumber);
    const engineStore = getEngineStore();
    engineStore.dispatch(setCurrentFrame(frameNumber));
  };

  const handleCurrentFrameChange = (frame: number) => {
    console.log('Frame changed:', frame);
    const engineStore = getEngineStore();
    engineStore.dispatch(setCurrentFrame(frame));
  };

  const handleMergeCells = (trackId: string, startFrame: number, endFrame: number) => {
    console.log('Merge cells requested:', { trackId, startFrame, endFrame });

    // Use internal mapping to get layer ID
    const layerId = trackToLayerMap.current.get(trackId);
    if (layerId) {
      const length = endFrame - startFrame + 1;
      const engineStore = getEngineStore();

      console.log('Dispatching addTimelineClip:', { layerId, startFrame, length });
      engineStore.dispatch(addTimelineClip(layerId, startFrame, length));
    }
  };

  const handleSplitClip = (trackId: string, clipId: string, splitFrame: number) => {
    console.log('Split clip requested:', { trackId, clipId, splitFrame });

    // Use internal mapping to get layer ID
    const layerId = trackToLayerMap.current.get(trackId);
    if (layerId) {
      const engineStore = getEngineStore();

      console.log('Dispatching splitTimelineClip:', { layerId, clipId, splitFrame });
      engineStore.dispatch(splitTimelineClip(layerId, clipId, splitFrame));
    }
  };

  const handleCellRightClick = (trackId: string, frameNumber: number, x: number, y: number) => {
    console.log('Cell right-clicked:', { trackId, frameNumber, x, y });

    // Show context menu
    setContextMenu({
      visible: true,
      x,
      y,
      frameNumber
    });
  };

  const handleSetProjectEnd = () => {
    if (!contextMenu) return;

    const engineStore = getEngineStore();

    engineStore.dispatch(setAnimationEndFrame({ frame: contextMenu.frameNumber }));
    console.log(`Set animation end to frame ${contextMenu.frameNumber}`);

    setContextMenu(null);
  };

  // Context menu items
  const contextMenuItems: MenuProps['items'] = [
    {
      key: 'set-animation-end',
      label: `Set Animation End (Frame ${contextMenu?.frameNumber ?? 0})`,
      onClick: handleSetProjectEnd,
    },
  ];

  return (
    <div style={{
      width: '100%',
      height: timelineHeight ? `${timelineHeight}px` : '100%',
      background: '#1e1e1e'
    }}>
      <Timeline
        frameCount={totalFrames}
        fps={fps}
        currentFrame={currentFrame}
        animationEndFrame={animationEndFrame}
        tracks={tracks}
        onCellClick={handleCellClick}
        onCurrentFrameChange={handleCurrentFrameChange}
        onMergeCells={handleMergeCells}
        onSplitClip={handleSplitClip}
        onCellRightClick={handleCellRightClick}
      />

      {/* Context menu for Timeline */}
      {contextMenu && (
        <Dropdown
          menu={{ items: contextMenuItems }}
          open={contextMenu.visible}
          onOpenChange={(visible) => {
            if (!visible) setContextMenu(null);
          }}
        >
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            }}
          />
        </Dropdown>
      )}
    </div>
  );
};

export default TimelinePanel;

