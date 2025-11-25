import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import LanguageSwitcher from './LanguageSwitcher';
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
  const { t } = useTranslation();

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
        <Tooltip title={t('tooltips.saveShortcut')}>
          <Button
            type="text"
            icon={<SaveOutlined />}
            onClick={onSave}
            className="main-menu-button"
          >
            {t('mainMenu.save')}
          </Button>
        </Tooltip>
        <Tooltip title={t('tooltips.openShortcut')}>
          <Button
            type="text"
            icon={<FolderOpenOutlined />}
            onClick={onOpen}
            className="main-menu-button"
          >
            {t('mainMenu.open')}
          </Button>
        </Tooltip>
        <Tooltip title={t('tooltips.preview')}>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={onPreview}
            className="main-menu-button"
          >
            {t('mainMenu.preview')}
          </Button>
        </Tooltip>
        <div className="main-menu-divider" />
        <Tooltip title={t('tooltips.undoShortcut')}>
          <Button
            type="text"
            icon={<UndoOutlined />}
            onClick={onUndo}
            className="main-menu-button"
          />
        </Tooltip>
        <Tooltip title={t('tooltips.redoShortcut')}>
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
          <Tooltip title={t('tooltips.play')}>
            <Button
              type="primary"
              icon={<CaretRightOutlined />}
              onClick={onPlay}
              className="main-menu-play-button"
              size="large"
            >
              {t('mainMenu.play')}
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title={t('tooltips.pause')}>
            <Button
              type="primary"
              icon={<PauseOutlined />}
              onClick={onPause}
              className="main-menu-pause-button"
              size="large"
              danger
            >
              {t('mainMenu.pause')}
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Right Section: Empty for now, can be used for future features */}
      <div className="main-menu-section main-menu-right">
        <LanguageSwitcher />
      </div>
    </div>
  );
};

export default MainMenu;

