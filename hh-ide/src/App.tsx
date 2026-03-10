import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getKernel, KernelBridge } from '@huahuo/engine';
import FlexLayoutWrapper from './components/FlexLayoutWrapper';
import MainMenu from './components/MainMenu';
import { message, Spin } from 'antd';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [kernelReady, setKernelReady] = useState(false);

  useEffect(() => {
    // Initialize the Rust/WASM kernel once on startup
    KernelBridge.getInstance().init().then(() => {
      console.info('🎉 HuaHuo IDE loaded — Rust kernel ready');
      setKernelReady(true);
    }).catch(err => {
      console.error('Failed to initialize Rust kernel:', err);
      message.error('Failed to load animation engine');
    });
  }, []);

  const handleSave = () => {
    message.success(t('messages.projectSaved'));
    // TODO: getKernel().saveBytes() and write to file
  };

  const handleOpen = () => {
    message.info(t('messages.openingProject'));
    // TODO: read file bytes → getKernel().loadBytes(bytes)
  };

  const handlePreview = () => {
    message.info(t('messages.openingPreview'));
  };

  const handleUndo = () => {
    message.info(t('messages.undo'));
    // TODO: implement undo via kernel command
  };

  const handleRedo = () => {
    message.info(t('messages.redo'));
    // TODO: implement redo via kernel command
  };

  const handlePlay = () => {
    getKernel().play();
    message.success(t('messages.playing'));
  };

  const handlePause = () => {
    getKernel().pause();
    message.warning(t('messages.paused'));
  };

  const handleStop = () => {
    getKernel().stop();
    message.info(t('messages.stopped'));
  };

  if (!kernelReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spin size="large" tip="Loading animation engine...">
          <div style={{ padding: 48, background: 'rgba(0,0,0,0)', borderRadius: 4 }} />
        </Spin>
      </div>
    );
  }

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
