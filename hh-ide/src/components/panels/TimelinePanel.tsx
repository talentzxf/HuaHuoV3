import React, { useState, useEffect } from 'react';
import { Timeline } from '@huahuo/timeline';
import { getEngineStore } from '@huahuo/sdk';

/**
 * TimelinePanel - Integrates the Timeline component with the engine
 */
const TimelinePanel: React.FC = () => {
  const [layers, setLayers] = useState<Array<{ id: string; name: string; frameCount: number }>>([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Load layers from engine
  useEffect(() => {
    const updateLayers = () => {
      const engineStore = getEngineStore();
      const state = engineStore.getState();
      const engineState = state.engine || state;

      const layerList = Object.values(engineState.layers.byId).map((layer: any) => ({
        id: layer.id,
        name: layer.name,
        frameCount: layer.frameCount || 120
      }));

      setLayers(layerList);
    };

    updateLayers();

    // Subscribe to engine store changes
    const engineStore = getEngineStore();
    const unsubscribe = engineStore.subscribe(() => {
      updateLayers();
    });

    return () => unsubscribe();
  }, []);

  const handleCellClick = (layerId: string, cellId: number) => {
    console.log('Cell clicked:', layerId, cellId);
    // Update elapsed time based on cell click
    const newTime = (cellId + 0.5) / 30; // Assuming 30 FPS
    setElapsedTime(newTime);
  };

  const handleFrameChange = (frame: number) => {
    console.log('Frame changed:', frame);
    const newTime = frame / 30;
    setElapsedTime(newTime);
  };

  const handleTrackSelect = (layerId: string) => {
    console.log('Track selected:', layerId);
    // Could dispatch selection action here
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#1e1e1e' }}>
      <Timeline
        frameCount={120}
        fps={30}
        elapsedTime={elapsedTime}
        layers={layers}
        onCellClick={handleCellClick}
        onFrameChange={handleFrameChange}
        onTrackSelect={handleTrackSelect}
      />
    </div>
  );
};

export default TimelinePanel;

