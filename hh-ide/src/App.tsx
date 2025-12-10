import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { playAnimation, pauseAnimation, stopAnimation, getEngineStore } from '@huahuo/engine';
import FlexLayoutWrapper from './components/FlexLayoutWrapper';
import MainMenu from './components/MainMenu';
import { message } from 'antd';

const App: React.FC = () => {
  const { t } = useTranslation();

  useEffect(() => {
    console.info('🎉 HuaHuo IDE loaded successfully!');
  }, []);

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
    const engineStore = getEngineStore();
    (engineStore.dispatch as any)(playAnimation());
    message.success(t('messages.playing'));
  };

  const handlePause = () => {
    const engineStore = getEngineStore();
    (engineStore.dispatch as any)(pauseAnimation());
    message.warning(t('messages.paused'));
  };

  const handleStop = () => {
    const engineStore = getEngineStore();
    (engineStore.dispatch as any)(stopAnimation());
    message.info(t('messages.stopped'));
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
        onStop={handleStop}
      />
      <FlexLayoutWrapper />
    </>
  );
};

export default App;

