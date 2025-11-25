import React, { useEffect } from 'react';
import {
  SaveOutlined,
  FolderOpenOutlined,
  EyeOutlined,
  UndoOutlined,
  RedoOutlined,
  CaretRightOutlined,
  PauseOutlined,
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import './MainMenu.css';

interface MainMenuProps {
  onSave?: () => void;
  onOpen?: () => void;
  onPreview?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  isPlaying?: boolean;
}

const MainMenu: React.FC<MainMenuProps> = ({
  onSave,
  onOpen,
  onPreview,
  onUndo,
  onRedo,
  onPlay,
  onPause,
  isPlaying = false,
}) => {
  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
      // Ctrl+O: Open
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        onOpen?.();
      }
      // Ctrl+Z: Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
      }
      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        onRedo?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSave, onOpen, onUndo, onRedo]);

  return (
    <div className="main-menu-container">
      {/* Left Section: File Operations */}
      <div className="main-menu-section main-menu-left">
        <Tooltip title="Save (Ctrl+S)">
          <Button
            type="text"
            icon={<SaveOutlined />}
            onClick={onSave}
            className="main-menu-button"
          >
            Save
          </Button>
        </Tooltip>
        <Tooltip title="Open (Ctrl+O)">
          <Button
            type="text"
            icon={<FolderOpenOutlined />}
            onClick={onOpen}
            className="main-menu-button"
          >
            Open
          </Button>
        </Tooltip>
        <Tooltip title="Preview">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={onPreview}
            className="main-menu-button"
          >
            Preview
          </Button>
        </Tooltip>
        <div className="main-menu-divider" />
        <Tooltip title="Undo (Ctrl+Z)">
          <Button
            type="text"
            icon={<UndoOutlined />}
            onClick={onUndo}
            className="main-menu-button"
          />
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Y)">
          <Button
            type="text"
            icon={<RedoOutlined />}
            onClick={onRedo}
            className="main-menu-button"
          />
        </Tooltip>
      </div>

      {/* Center Section: Play/Pause Controls */}
      <div className="main-menu-section main-menu-center">
        {!isPlaying ? (
          <Tooltip title="Play">
            <Button
              type="primary"
              icon={<CaretRightOutlined />}
              onClick={onPlay}
              className="main-menu-play-button"
              size="large"
            >
              Play
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title="Pause">
            <Button
              type="primary"
              icon={<PauseOutlined />}
              onClick={onPause}
              className="main-menu-pause-button"
              size="large"
              danger
            >
              Pause
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Right Section: Empty for now, can be used for future features */}
      <div className="main-menu-section main-menu-right">
        {/* Reserved for future use */}
      </div>
    </div>
  );
};

export default MainMenu;

