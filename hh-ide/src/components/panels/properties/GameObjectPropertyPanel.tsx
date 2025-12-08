import React, { useState, useEffect, memo, useMemo, useCallback } from 'react';
import { Typography, Collapse, Input, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { SDK } from '@huahuo/sdk';
import { getEngineStore, getEngineState, ComponentRegistry, updateComponentPropsWithKeyFrame } from '@huahuo/engine';
import type { ComponentSlice } from '@huahuo/sdk';
import PropertyTypeRegistry from './PropertyTypeRegistry';
import { registerDefaultPropertyRenderers } from './defaultPropertyRenderers';

const { Text } = Typography;

// Initialize default property renderers on module load
registerDefaultPropertyRenderers();

interface GameObjectPropertyPanelProps {
  gameObjectId: string;
}

// Memoized component for rendering a single property field
const PropertyField = memo<{
  componentId: string;
  componentType: string;
  propName: string;
  propValue: any;
  onPropertyChange: (componentId: string, propName: string, value: any) => void;
}>(({ componentId, componentType, propName, propValue, onPropertyChange }) => {
  const handleChange = useCallback((value: any) => {
    onPropertyChange(componentId, propName, value);
  }, [componentId, propName, onPropertyChange]);

  const registry = ComponentRegistry.getInstance();
  const propertyMeta = registry.getPropertyMetadata(componentType, propName);

  // Get the appropriate renderer from PropertyTypeRegistry
  const propertyTypeRegistry = PropertyTypeRegistry.getInstance();
  const renderer = propertyTypeRegistry.getRenderer(propValue);

  if (!renderer) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
        <Text style={{ color: '#999999', fontSize: '12px', fontStyle: 'italic' }}>
          Unsupported type
        </Text>
      </div>
    );
  }

  return renderer({
    propName,
    propValue,
    propertyMeta,
    onChange: handleChange,
  });
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if the specific property value changed
  return (
    prevProps.componentId === nextProps.componentId &&
    prevProps.componentType === nextProps.componentType &&
    prevProps.propName === nextProps.propName &&
    JSON.stringify(prevProps.propValue) === JSON.stringify(nextProps.propValue) &&
    prevProps.onPropertyChange === nextProps.onPropertyChange
  );
});

PropertyField.displayName = 'PropertyField';

// Memoized component for rendering a single component's properties
const ComponentPropertiesPanel = memo<{
  component: ComponentSlice;
  onPropertyChange: (componentId: string, propName: string, value: any) => void;
}>(({ component, onPropertyChange }) => {
  return (
    <div style={{ padding: '4px 0' }}>
      {Object.entries(component.props).map(([propName, propValue]) => (
        <PropertyField
          key={propName}
          componentId={component.id}
          componentType={component.type}
          propName={propName}
          propValue={propValue}
          onPropertyChange={onPropertyChange}
        />
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if component data actually changed
  return (
    prevProps.component.id === nextProps.component.id &&
    prevProps.component.type === nextProps.component.type &&
    JSON.stringify(prevProps.component.props) === JSON.stringify(nextProps.component.props) &&
    prevProps.onPropertyChange === nextProps.onPropertyChange
  );
});

ComponentPropertiesPanel.displayName = 'ComponentPropertiesPanel';

const GameObjectPropertyPanel: React.FC<GameObjectPropertyPanelProps> = memo(({ gameObjectId }) => {
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

  const handlePropertyChange = useCallback((componentId: string, propName: string, value: any) => {
    if (!SDK.isInitialized()) return;

    const store = getEngineStore();
    const engineState = getEngineState();

    const component = engineState.components.byId[componentId];
    if (!component) return;

    const currentPropValue = component.props[propName];
    let finalValue = value;

    // Merge objects if needed
    if (typeof currentPropValue === 'object' && currentPropValue !== null &&
        typeof value === 'object' && value !== null) {
      finalValue = { ...currentPropValue, ...value };
    }

    // Use updateComponentPropsWithKeyFrame to update both component props AND keyframes
    // Cast to any because thunk types are not fully compatible
    (store.dispatch as any)(updateComponentPropsWithKeyFrame({
      id: componentId,
      patch: { [propName]: finalValue }
    }));
  }, []);

  // Use useMemo to cache component items - each component is independently memoized
  const componentItems = useMemo(() => {
    return components.map((component: ComponentSlice) => ({
      key: component.id,
      label: component.type,
      children: (
        <ComponentPropertiesPanel
          component={component}
          onPropertyChange={handlePropertyChange}
        />
      ),
    }));
  }, [components, handlePropertyChange]);

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
            items={componentItems}
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
});

export default GameObjectPropertyPanel;

