import React, { useState, useEffect } from 'react';
import { Typography, Collapse, Input, InputNumber, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { SDK } from '@huahuo/sdk';
import { getEngineStore, getEngineState, ComponentRegistry } from '@huahuo/engine';
import type { ComponentSlice } from '@huahuo/sdk';

const { Text } = Typography;

interface GameObjectPropertyPanelProps {
  gameObjectId: string;
}

const GameObjectPropertyPanel: React.FC<GameObjectPropertyPanelProps> = ({ gameObjectId }) => {
  const { t } = useTranslation();
  const [gameObjectData, setGameObjectData] = useState<any>(null);
  const [components, setComponents] = useState<ComponentSlice[]>([]);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!gameObjectId || !SDK.isInitialized()) {
      setGameObjectData(null);
      setComponents([]);
      setActiveKeys([]);
      return;
    }

    const updateData = () => {
      const state = getEngineState();
      const gameObject = state.gameObjects.byId[gameObjectId];

      if (!gameObject) {
        setGameObjectData(null);
        setComponents([]);
        setActiveKeys([]);
        return;
      }

      setGameObjectData(gameObject);

      const gameObjectComponents = gameObject.componentIds
        .map((compId: string) => state.components.byId[compId])
        .filter(Boolean);

      setComponents(gameObjectComponents);
      setActiveKeys(gameObjectComponents.map(c => c.id));
    };

    updateData();

    const store = getEngineStore();
    const unsubscribe = store.subscribe(() => {
      updateData();
    });

    return () => unsubscribe();
  }, [gameObjectId]);

  const handlePropertyChange = (componentId: string, propName: string, value: any) => {
    if (SDK.isInitialized()) {
      const store = getEngineStore();
      const state = getEngineState();

      const component = state.components.byId[componentId];
      if (!component) return;

      const currentPropValue = component.props[propName];
      let finalValue = value;

      if (typeof currentPropValue === 'object' && currentPropValue !== null &&
          typeof value === 'object' && value !== null) {
        finalValue = { ...currentPropValue, ...value };
      }

      store.dispatch({
        type: 'components/updateComponentProps',
        payload: {
          id: componentId,
          patch: { [propName]: finalValue }
        }
      });
    }
  };

  const renderPropertyField = (componentId: string, componentType: string, propName: string, propValue: any) => {
    const handleChange = (value: any) => {
      handlePropertyChange(componentId, propName, value);
    };

    const registry = ComponentRegistry.getInstance();
    const propertyMeta = registry.getPropertyMetadata(componentType, propName);

    const step = propertyMeta?.step ?? 0.1;
    const precision = propertyMeta?.precision ?? 2;
    const min = propertyMeta?.min;
    const max = propertyMeta?.max;

    if (typeof propValue === 'boolean') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
          <Switch checked={propValue} onChange={handleChange} size="small" />
        </div>
      );
    } else if (typeof propValue === 'number') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
          <InputNumber
            value={propValue}
            onChange={handleChange}
            onKeyDown={(e) => e.stopPropagation()}
            size="small"
            precision={precision}
            step={step}
            min={min}
            max={max}
            style={{ width: '100px' }}
          />
        </div>
      );
    } else if (typeof propValue === 'string') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
          <Input
            value={propValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            size="small"
            style={{ width: '140px' }}
          />
        </div>
      );
    } else if (typeof propValue === 'object' && propValue !== null) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Object.entries(propValue).map(([key, val]) => (
              <InputNumber
                key={key}
                value={val as number}
                onChange={(newVal) => {
                  const updatedObj = { ...propValue, [key]: newVal };
                  handleChange(updatedObj);
                }}
                onKeyDown={(e) => e.stopPropagation()}
                size="small"
                precision={precision}
                step={step}
                style={{ width: '60px' }}
              />
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderComponent = (component: ComponentSlice) => ({
    key: component.id,
    label: component.type,
    children: (
      <div style={{ padding: '4px 0' }}>
        {Object.entries(component.props).map(([propName, propValue]) => (
          <div key={propName}>
            {renderPropertyField(component.id, component.type, propName, propValue)}
          </div>
        ))}
      </div>
    ),
  });

  if (!gameObjectData) {
    return (
      <div className="property-panel" style={{ padding: '12px' }}>
        <Text style={{ color: '#999999', fontStyle: 'italic', fontSize: '12px' }}>
          {t('propertyPanel.selectGameObject', 'Select a GameObject to view properties')}
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
    <div className="property-panel" style={{ padding: '12px' }}>
      {/* GameObject Name + Active */}
      <div style={rowStyle}>
        <Text style={labelStyle}>Name:</Text>
        <Input
          value={gameObjectData.name}
          onChange={(e) => handlePropertyChange(gameObjectId, 'name', e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          size="small"
          style={{ flex: 1 }}
        />
        <Text style={{ ...labelStyle, width: 'auto', marginLeft: '8px' }}>Active:</Text>
        <Switch
          checked={gameObjectData.active}
          onChange={(checked) => handlePropertyChange(gameObjectId, 'active', checked)}
          size="small"
        />
      </div>

      {/* Components */}
      <div className="property-panel-components">
        {components.length > 0 ? (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            items={components.map(renderComponent)}
            ghost
            size="small"
            style={{ background: 'transparent' }}
          />
        ) : (
          <Text style={{ color: '#999999', fontStyle: 'italic', fontSize: '12px' }}>
            {t('propertyPanel.noComponents')}
          </Text>
        )}
      </div>
    </div>
  );
};

export default GameObjectPropertyPanel;

