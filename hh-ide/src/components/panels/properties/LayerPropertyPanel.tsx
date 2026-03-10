import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Typography, Divider, Switch, Input } from 'antd';
import { getKernel } from '@huahuo/engine';
import './LayerPropertyPanel.css';

const { Text } = Typography;

interface LayerPropertyPanelProps {
  layerId: string;
}

const LayerPropertyPanel: React.FC<LayerPropertyPanelProps> = ({ layerId }) => {
  const { t } = useTranslation();
  const [layerData, setLayerData] = useState<any>(null);

  useEffect(() => {
    if (!layerId) { setLayerData(null); return; }

    const refresh = () => {
      const kernel = getKernel();
      if (!kernel.ready) return;
      // Layer data is inside the scene
      const scene = kernel.getCurrentScene();
      if (!scene) { setLayerData(null); return; }
      const layer = scene.layers?.[layerId];
      setLayerData(layer ?? null);
    };

    refresh();

    // Subscribe to layer events for this specific layer
    const kernel = getKernel();
    if (!kernel.ready) return;
    const sub = kernel.subscribe(`layer/${layerId}`, () => refresh());
    return () => kernel.unsubscribe(sub);
  }, [layerId]);

  const handleNameChange = (value: string) => {
    // TODO: add RenameLayer command to kernel
    console.warn('[LayerPropertyPanel] Layer rename not yet implemented in kernel');
  };

  const handleVisibleChange = (checked: boolean) => {
    // TODO: add SetLayerVisible command to kernel
    console.warn('[LayerPropertyPanel] Layer visibility not yet implemented in kernel');
  };

  const handleHasTimelineChange = (checked: boolean) => {
    console.warn('[LayerPropertyPanel] hasTimeline not yet implemented in kernel');
  };

  if (!layerId || !layerData) {
    return (
      <div className="layer-property-panel">
        <Text style={{ color: '#999', fontStyle: 'italic' }}>
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
          value={layerData.name ?? ''}
          onChange={(e) => handleNameChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          size="small"
          style={{ flex: 1 }}
        />
        <Text style={{ ...labelStyle, width: 'auto', marginLeft: '8px' }}>Active:</Text>
        <Switch
          checked={layerData.visible ?? true}
          onChange={handleVisibleChange}
          size="small"
        />
      </div>

      <div style={rowStyle}>
        <Text style={labelStyle}>Use Timeline:</Text>
        <Switch
          checked={layerData.hasTimeline ?? true}
          onChange={handleHasTimelineChange}
          size="small"
        />
      </div>
    </div>
  );
};

export default LayerPropertyPanel;
