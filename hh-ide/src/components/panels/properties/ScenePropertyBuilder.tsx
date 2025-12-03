import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PropertyBuilder } from './PropertyBuilder';
import { InputNumber, Typography, Input, Tooltip, Space } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { InstanceRegistry } from '@huahuo/engine';
import type { IScene } from '@huahuo/sdk';

const { Text } = Typography;

export class ScenePropertyBuilder extends PropertyBuilder {
  canHandle(type: string): boolean {
    return type === 'scene';
  }

  buildPropertyPanel(selectedId: string): React.ReactElement {
    const scene = InstanceRegistry.getInstance().get<IScene>(selectedId);

    if (!scene) {
      return (
        <div style={{ padding: '16px' }}>
          <Text type="danger">Scene not found: {selectedId}</Text>
        </div>
      );
    }

    return <div className="property-panel">{this.build(scene)}</div>;
  }

  build(scene: IScene): React.ReactNode {
    return <ScenePropertyForm scene={scene} />;
  }
}

// Separate functional component for state management
const ScenePropertyForm: React.FC<{ scene: IScene }> = ({ scene }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(scene.name);
  const [duration, setDuration] = useState(scene.duration);
  const [fps, setFps] = useState(scene.fps);

  // Sync local state with scene when scene changes
  useEffect(() => {
    setName(scene.name);
    setDuration(scene.duration);
    setFps(scene.fps);
  }, [scene.name, scene.duration, scene.fps]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleNameBlur = () => {
    if (name && name !== scene.name) {
      scene.name = name;
    }
  };

  const handleDurationChange = (value: number | null) => {
    if (value !== null && value !== undefined) {
      setDuration(value);
      scene.duration = value;
    }
  };

  const handleFpsChange = (value: number | null) => {
    if (value !== null && value !== undefined) {
      setFps(value);
      scene.fps = value;
    }
  };

  // Prevent key events from bubbling up
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const labelStyle: React.CSSProperties = {
    width: '80px',
    flexShrink: 0,
    color: '#999',
    fontSize: '12px',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    gap: '8px',
  };

  return (
    <div style={{ padding: '12px' }}>
      {/* Scene Name */}
      <div style={rowStyle}>
        <Text style={labelStyle}>Scene Name:</Text>
        <Input
          value={name}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          onPressEnter={handleNameBlur}
          onKeyDown={handleKeyDown}
          placeholder={t('propertyPanel.scene.namePlaceholder')}
          size="small"
          style={{ flex: 1 }}
        />
        <Tooltip title={t('propertyPanel.scene.nameTooltip')}>
          <QuestionCircleOutlined style={{ color: '#999', fontSize: '12px' }} />
        </Tooltip>
      </div>

      {/* Duration */}
      <div style={rowStyle}>
        <Text style={labelStyle}>{t('propertyPanel.scene.duration')}:</Text>
        <Space.Compact style={{ flex: 1 }}>
          <InputNumber
            value={duration}
            min={0.1}
            max={3600}
            step={0.1}
            precision={1}
            size="small"
            style={{ width: '100%' }}
            onChange={handleDurationChange}
            onKeyDown={handleKeyDown}
          />
          <Input
            size="small"
            value={t('propertyPanel.scene.durationUnit')}
            readOnly
            style={{ width: '40px', textAlign: 'center', cursor: 'default' }}
          />
        </Space.Compact>
        <Tooltip title={t('propertyPanel.scene.durationTooltip')}>
          <QuestionCircleOutlined style={{ color: '#999', fontSize: '12px' }} />
        </Tooltip>
      </div>

      {/* FPS */}
      <div style={rowStyle}>
        <Text style={labelStyle}>{t('propertyPanel.scene.fps')}:</Text>
        <InputNumber
          value={fps}
          min={1}
          max={120}
          step={1}
          size="small"
          style={{ flex: 1 }}
          onChange={handleFpsChange}
          onKeyDown={handleKeyDown}
        />
        <Tooltip title={t('propertyPanel.scene.fpsTooltip')}>
          <QuestionCircleOutlined style={{ color: '#999', fontSize: '12px' }} />
        </Tooltip>
      </div>

      {/* Total Frames (Read-only) */}
      <div style={rowStyle}>
        <Text style={labelStyle}>{t('propertyPanel.scene.totalFrames')}:</Text>
        <Text style={{ flex: 1, fontSize: '12px' }}>
          {Math.ceil(duration * fps)} frames
        </Text>
        <Tooltip title={t('propertyPanel.scene.totalFramesTooltip')}>
          <QuestionCircleOutlined style={{ color: '#999', fontSize: '12px' }} />
        </Tooltip>
      </div>
    </div>
  );
};

