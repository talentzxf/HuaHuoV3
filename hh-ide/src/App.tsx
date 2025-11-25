import React, { useState } from 'react';
import FlexLayoutWrapper from './components/FlexLayoutWrapper';
import MainMenu from './components/MainMenu';
import { message } from 'antd';

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSave = () => {
    message.success('Project saved successfully!');
    // TODO: Implement save logic
  };

  const handleOpen = () => {
    message.info('Opening project...');
    // TODO: Implement open logic
  };

  const handlePreview = () => {
    message.info('Opening preview...');
    // TODO: Implement preview logic
  };

  const handleUndo = () => {
    message.info('Undo');
    // TODO: Implement undo logic
  };

  const handleRedo = () => {
    message.info('Redo');
    // TODO: Implement redo logic
  };

  const handlePlay = () => {
    setIsPlaying(true);
    message.success('Playing...');
    // TODO: Implement play logic
  };

  const handlePause = () => {
    setIsPlaying(false);
    message.warning('Paused');
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

