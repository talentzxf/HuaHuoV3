import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Typography, Divider, Switch, Input } from 'antd';
import { getEngineStore } from '@huahuo/engine';
import { renameLayer, setLayerVisible, setLayerHasTimeline } from '@huahuo/sdk';
import './LayerPropertyPanel.css';

const { Text } = Typography;

interface LayerPropertyPanelProps {
  layerId: string;
}

const LayerPropertyPanel: React.FC<LayerPropertyPanelProps> = ({ layerId }) => {
  const { t } = useTranslation();
  const [layerData, setLayerData] = useState<any>(null);

  useEffect(() => {
    console.debug('[LayerPropertyPanel] layerId changed:', layerId);

    if (!layerId) {
      setLayerData(null);
      return;
    }

    const updateData = () => {
      const engineStore = getEngineStore();
      const state = engineStore.getState();
      const engineState = state.engine || state;

      const layer = engineState.layers.byId[layerId];
      console.debug('[LayerPropertyPanel] Layer data:', layer);

      if (!layer) {
        setLayerData(null);
        return;
      }

      setLayerData(layer);
    };

    updateData();

    // Subscribe to engine store changes
    const engineStore = getEngineStore();
    const unsubscribe = engineStore.subscribe(() => {
      updateData();
    });

    return () => unsubscribe();
  }, [layerId]);

  const handleNameChange = (value: string) => {
    if (!layerId) return;

    const engineStore = getEngineStore();
    engineStore.dispatch(renameLayer({
      layerId: layerId,
      name: value
    }));
  };

  const handleVisibleChange = (checked: boolean) => {
    if (!layerId) return;

    const engineStore = getEngineStore();
    engineStore.dispatch(setLayerVisible({
      layerId: layerId,
      visible: checked
    }));
  };

  const handleHasTimelineChange = (checked: boolean) => {
    if (!layerId) return;

    const engineStore = getEngineStore();
    engineStore.dispatch(setLayerHasTimeline({
      layerId: layerId,
      hasTimeline: checked
    }));
  };

  if (!layerId || !layerData) {
    return (
      <div className="layer-property-panel">
        <Text style={{ color: '#999999', fontStyle: 'italic' }}>
          {t('layerPropertyPanel.selectLayer', 'Select a Layer to view properties')}
        </Text>
      </div>
    );
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    gap: '8px',
  };

  const labelStyle: React.CSSProperties = {
    width: '80px',
    flexShrink: 0,
    color: '#999',
    fontSize: '12px',
  };

  return (
    <div className="layer-property-panel" style={{ padding: '12px' }}>
      {/* 第一行：Layer Name + Active */}
      <div style={rowStyle}>
        <Text style={labelStyle}>Layer Name:</Text>
        <Input
          value={layerData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          size="small"
          style={{ flex: 1 }}
        />
        <Text style={{ ...labelStyle, width: 'auto', marginLeft: '8px' }}>Active:</Text>
        <Switch
          checked={layerData.visible}
          onChange={handleVisibleChange}
          size="small"
        />
      </div>

      <div style={rowStyle}>
        <Text style={labelStyle}>Use Timeline:</Text>
        <Switch
          checked={layerData.hasTimeline}
          onChange={handleHasTimelineChange}
          size="small"
        />
      </div>
    </div>
  );
};

export default LayerPropertyPanel;
