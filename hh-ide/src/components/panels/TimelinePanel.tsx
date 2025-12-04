import React, { useState, useEffect } from 'react';
import { Timeline } from '@huahuo/timeline';
import { getEngineStore } from '@huahuo/engine';
import { addTimelineClip, splitTimelineClip } from '@huahuo/engine';

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
  }>>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [timelineHeight, setTimelineHeight] = useState<number | undefined>(undefined);

  // Internal mapping from track ID to layer ID (not exposed to Timeline component)
  const trackToLayerMap = React.useRef<Map<string, string>>(new Map());

  // Load layers from engine and map to timeline tracks
  useEffect(() => {
    const updateTracks = () => {
      const engineStore = getEngineStore();
      const state = engineStore.getState();
      const engineState = state.engine || state;

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
            clips: layer.clips || []  // Include clips from layer
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

    // Subscribe to engine store changes
    const engineStore = getEngineStore();
    const unsubscribe = engineStore.subscribe(() => {
      updateTracks();
    });

    return () => unsubscribe();
  }, []);

  const handleCellClick = (trackId: string, frameNumber: number) => {
    console.log('Cell clicked:', trackId, frameNumber);
    setCurrentFrame(frameNumber);

    // Use internal mapping to get layer ID if needed for engine operations
    const layerId = trackToLayerMap.current.get(trackId);
    if (layerId) {
      // Dispatch engine actions using layerId
      // e.g., engineStore.dispatch(someAction({ layerId, frame: frameNumber }));
    }
  };

  const handleCurrentFrameChange = (frame: number) => {
    console.log('Frame changed:', frame);
    setCurrentFrame(frame);
    // Could sync frame to engine playback state
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

  return (
    <div style={{
      width: '100%',
      height: timelineHeight ? `${timelineHeight}px` : '100%',
      background: '#1e1e1e'
    }}>
      <Timeline
        frameCount={120}
        fps={30}
        currentFrame={currentFrame}
        tracks={tracks}
        onCellClick={handleCellClick}
        onCurrentFrameChange={handleCurrentFrameChange}
        onMergeCells={handleMergeCells}
        onSplitClip={handleSplitClip}
      />
    </div>
  );
};

export default TimelinePanel;

