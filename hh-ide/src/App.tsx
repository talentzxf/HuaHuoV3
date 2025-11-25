import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FlexLayoutWrapper from './components/FlexLayoutWrapper';
import MainMenu from './components/MainMenu';
import { message } from 'antd';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSave = () => {
    message.success(t('messages.projectSaved'));
    // TODO: Implement save logic
  };

  const handleOpen = () => {
    message.info(t('messages.openingProject'));
    // TODO: Implement open logic
  };

  const handlePreview = () => {
    message.info(t('messages.openingPreview'));
    // TODO: Implement preview logic
  };

  const handleUndo = () => {
    message.info(t('messages.undo'));
    // TODO: Implement undo logic
  };

  const handleRedo = () => {
    message.info(t('messages.redo'));
    // TODO: Implement redo logic
  };

  const handlePlay = () => {
    setIsPlaying(true);
    message.success(t('messages.playing'));
    // TODO: Implement play logic
  };

  const handlePause = () => {
    setIsPlaying(false);
    message.warning(t('messages.paused'));
    // TODO: Implement pause logic
  };

  return (
    <>
      <MainMenu
        onSave={handleSave}
        onOpen={handleOpen}
        onPreview={handlePreview}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPlay={handlePlay}
        onPause={handlePause}
        isPlaying={isPlaying}
      />
      <FlexLayoutWrapper />
    </>
  );
};

export default App;

