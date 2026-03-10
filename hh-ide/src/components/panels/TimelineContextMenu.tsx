import React from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { getKernel } from '@huahuo/engine';
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
    // TODO: SetAnimationEndFrame kernel command
    console.warn('[TimelineContextMenu] SetAnimationEndFrame not yet in kernel', frameNumber);
    onClose();
  };

  // Handle split clip
  const handleSplitClip = () => {
    if (!clip || !trackId) return;
    // TODO: SplitTimelineClip kernel command
    console.warn('[TimelineContextMenu] SplitTimelineClip not yet in kernel', { trackId, clipId: clip.id, splitFrame: frameNumber });
    dispatch(requestCanvasRefresh());
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
