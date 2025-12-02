import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, InputNumber, Typography, Divider, Switch, Input } from 'antd';
import { getEngineStore } from '@huahuo/sdk';
import { setLayerFrameCount, renameLayer, setLayerVisible } from '@huahuo/sdk';
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

  const handleFrameCountChange = (value: number | null) => {
    if (!layerId || value === null) return;

    const engineStore = getEngineStore();
    engineStore.dispatch(setLayerFrameCount({
      layerId: layerId,
      frameCount: value
    }));
  };

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

  if (!layerId || !layerData) {
    return (
      <div className="layer-property-panel">
        <Text style={{ color: '#999999', fontStyle: 'italic' }}>
          {t('layerPropertyPanel.selectLayer', 'Select a Layer to view properties')}
        </Text>
      </div>
    );
  }

  return (
    <div className="layer-property-panel">
      <div className="layer-property-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <Switch
            checked={layerData.visible}
            onChange={handleVisibleChange}
            size="small"
          />
          <Input
            value={layerData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            size="small"
            style={{ width: '140px' }}
          />
        </div>
      </div>

      <Divider style={{ margin: '12px 0', borderColor: '#444' }} />

      <Form layout="vertical" size="small">
        <Form.Item
          label={t('layerPropertyPanel.frameCount', 'Frame Count')}
          style={{ marginBottom: '12px' }}
          help={t('layerPropertyPanel.frameCountHelp', '0 = No Timeline, >0 = Timeline with frames')}
        >
          <InputNumber
            min={0}
            max={10000}
            value={layerData.frameCount}
            onChange={handleFrameCountChange}
            onKeyDown={(e) => e.stopPropagation()}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </div>
  );
};

export default LayerPropertyPanel;
