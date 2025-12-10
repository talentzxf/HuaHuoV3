import React from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { getEngineStore, setAnimationEndFrame, splitTimelineClip } from '@huahuo/engine';
import { useDispatch } from 'react-redux';
import { requestCanvasRefresh } from '../../store/features/canvas/canvasSlice';

export interface TimelineClip {
  id: string;
  startFrame: number;
  length: number;
}

export interface TimelineContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  frameNumber: number;
  trackId?: string;
  clip?: TimelineClip;
  onClose: () => void;
}

export const TimelineContextMenu: React.FC<TimelineContextMenuProps> = ({
  visible,
  x,
  y,
  frameNumber,
  trackId,
  clip,
  onClose,
}) => {
  const dispatch = useDispatch();

  // Handle set animation end
  const handleSetAnimationEnd = () => {
    const engineStore = getEngineStore();
    engineStore.dispatch(setAnimationEndFrame({ frame: frameNumber }));
    console.log(`Set animation end to frame ${frameNumber}`);
    onClose();
  };

  // Handle split clip
  const handleSplitClip = () => {
    if (!clip || !trackId) return;

    const engineStore = getEngineStore();
    // trackId is actually layerId in CanvasPanel context
    const layerId = trackId;

    console.log('Split clip requested:', { layerId, clipId: clip.id, splitFrame: frameNumber });
    engineStore.dispatch(splitTimelineClip(layerId, clip.id, frameNumber));

    // Request canvas refresh via IDE store
    dispatch(requestCanvasRefresh());

    console.log(`Split clip ${clip.id} at frame ${frameNumber}`);
    onClose();
  };

  // Check if split is allowed (must be inside clip and not at start edge)
  const canSplit = clip && trackId && frameNumber > clip.startFrame;

  // Build menu items
  const menuItems: MenuProps['items'] = [
    {
      key: 'set-animation-end',
      label: `Set Animation End (Frame ${frameNumber})`,
      onClick: handleSetAnimationEnd,
    },
    // Conditionally add split clip option
    ...(canSplit
      ? [
          {
            key: 'split-clip',
            label: `Split Clip at Frame ${frameNumber}`,
            onClick: handleSplitClip,
          },
        ]
      : []),
  ];

  if (!visible) return null;

  return (
    <Dropdown
      menu={{ items: menuItems }}
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div
        style={{
          position: 'fixed',
          left: x,
          top: y,
          width: 1,
          height: 1,
          pointerEvents: 'none',
        }}
      />
    </Dropdown>
  );
};

