import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playAnimation, pauseAnimation, getEngineStore, getEngineState } from '@huahuo/engine';
import { SDK } from '@huahuo/sdk';
import FlexLayoutWrapper from './components/FlexLayoutWrapper';
import MainMenu from './components/MainMenu';
import { message } from 'antd';

const App: React.FC = () => {
  const { t } = useTranslation();

  // Get isPlaying from Engine state instead of IDE state
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    console.info('🎉 HuaHuo IDE loaded successfully!');

    // Wait for SDK initialization before subscribing to Engine store
    SDK.executeAfterInit(() => {
      // Subscribe to Engine playback state changes
      const engineStore = getEngineStore();
      const unsubscribe = engineStore.subscribe(() => {
        const engineState = getEngineState();
        setIsPlaying(engineState.playback.isPlaying);
      });

      // Get initial state
      const initialState = getEngineState();
      setIsPlaying(initialState.playback.isPlaying);
    });
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

