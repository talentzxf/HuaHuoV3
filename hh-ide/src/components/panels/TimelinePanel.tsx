import React, { useState, useEffect, useRef } from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Timeline } from '@huahuo/timeline';
import { getKernel } from '@huahuo/engine';

/**
 * TimelinePanel — driven by KernelBridge events instead of Redux store diffs.
 */
const TimelinePanel: React.FC = () => {
  const [tracks, setTracks] = useState<Array<{
    id: string;
    name: string;
    clips?: Array<{ id: string; startFrame: number; length: number }>;
    keyFrames?: number[];
  }>>([]);
  const [currentFrameState, setCurrentFrameState] = useState(0);
  const [totalFrames, setTotalFrames] = useState(120);
  const [fps, setFps] = useState(30);
  const [animationEndFrame, setAnimationEndFrame] = useState<number | null>(null);
  const [timelineHeight, setTimelineHeight] = useState<number | undefined>(undefined);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean; x: number; y: number; frameNumber: number;
  } | null>(null);

  const subIdsRef = useRef<number[]>([]);

  useEffect(() => {
    const kernel = getKernel();
    if (!kernel.ready) return;

    const refreshProject = () => {
      const p = kernel.getProject();
      if (!p) return;
      setTotalFrames(p.total_frames ?? 120);
      setFps(p.fps ?? 30);
      setAnimationEndFrame(p.animation_end_frame ?? null);
    };

    const refreshTracks = () => {
      const pb = kernel.getPlaybackState();
      setCurrentFrameState(pb?.current_frame ?? 0);

      const scene = kernel.getCurrentScene();
      if (!scene) { setTracks([]); return; }

      const trackList = Object.entries(scene.layers ?? {})
        .filter(([, layer]: [string, any]) => layer.has_timeline !== false)
        .map(([layerId, layer]: [string, any]) => ({
          id: layerId,
          name: layer.name ?? layerId,
          clips: layer.clips ?? [],
          keyFrames: (layer.key_frames ?? []).map((kf: any) => kf.frame ?? kf),
        }));

      setTracks(trackList);

      const HEADER_HEIGHT = 30, TRACK_HEIGHT = 30, SCROLLBAR_HEIGHT = 20;
      const calc = HEADER_HEIGHT + trackList.length * TRACK_HEIGHT + SCROLLBAR_HEIGHT;
      setTimelineHeight(calc <= 200 ? Math.max(50, calc) : undefined);
    };

    refreshProject();
    refreshTracks();

    const ids: number[] = [];
    ids.push(kernel.subscribe('playback/frame_changed', refreshTracks));
    ids.push(kernel.subscribe('playback/looped_back',   refreshTracks));
    ids.push(kernel.subscribe('playback/stopped',       refreshTracks));
    ids.push(kernel.subscribe('keyframe',               refreshTracks));
    ids.push(kernel.subscribe('go',                     refreshTracks));
    ids.push(kernel.subscribe('layer',                  refreshTracks));
    ids.push(kernel.subscribe('project',                refreshProject));
    subIdsRef.current = ids;

    return () => { ids.forEach(id => kernel.unsubscribe(id)); };
  }, []);

  const handleCellClick = (_trackId: string, frameNumber: number) =>
    getKernel().setCurrentFrame(frameNumber);

  const handleCurrentFrameChange = (frame: number) =>
    getKernel().setCurrentFrame(frame);

  const handleMergeCells = (trackId: string, startFrame: number, endFrame: number) => {
    console.warn('[TimelinePanel] AddTimelineClip not yet in kernel', { trackId, startFrame, endFrame });
  };

  const handleSplitClip = (trackId: string, clipId: string, splitFrame: number) => {
    console.warn('[TimelinePanel] SplitTimelineClip not yet in kernel', { trackId, clipId, splitFrame });
  };

  const handleCellRightClick = (_trackId: string, frameNumber: number, x: number, y: number) => {
    setContextMenu({ visible: true, x, y, frameNumber });
  };

  const handleSetProjectEnd = () => {
    if (!contextMenu) return;
    // TODO: SetAnimationEndFrame kernel command
    console.warn('[TimelinePanel] SetAnimationEndFrame not yet in kernel', contextMenu.frameNumber);
    setContextMenu(null);
  };

  const contextMenuItems: MenuProps['items'] = [
    {
      key: 'set-animation-end',
      label: `Set Animation End (Frame ${contextMenu?.frameNumber ?? 0})`,
      onClick: handleSetProjectEnd,
    },
  ];

  return (
    <div style={{ width: '100%', height: timelineHeight ? `${timelineHeight}px` : '100%', background: '#1e1e1e' }}>
      <Timeline
        frameCount={totalFrames}
        fps={fps}
        currentFrame={currentFrameState}
        animationEndFrame={animationEndFrame}
        tracks={tracks}
        onCellClick={handleCellClick}
        onCurrentFrameChange={handleCurrentFrameChange}
        onMergeCells={handleMergeCells}
        onSplitClip={handleSplitClip}
        onCellRightClick={handleCellRightClick}
      />

      {contextMenu && (
        <Dropdown
          menu={{ items: contextMenuItems }}
          open={contextMenu.visible}
          onOpenChange={(open) => { if (!open) setContextMenu(null); }}
        >
          <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, width: 1, height: 1, pointerEvents: 'none' }} />
        </Dropdown>
      )}
    </div>
  );
};

export default TimelinePanel;

