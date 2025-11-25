import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { setPlaying } from './store/features/playback/playbackSlice';
import FlexLayoutWrapper from './components/FlexLayoutWrapper';
import MainMenu from './components/MainMenu';
import { message } from 'antd';

const App: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isPlaying = useAppSelector((state) => state.playback.isPlaying);

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
    dispatch(setPlaying(true));
    message.success(t('messages.playing'));
    // TODO: Implement play logic
  };

  const handlePause = () => {
    dispatch(setPlaying(false));
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

