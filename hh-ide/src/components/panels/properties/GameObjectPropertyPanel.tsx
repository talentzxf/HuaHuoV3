import React, { useState, useEffect, memo, useMemo, useCallback, useRef } from 'react';
import { Typography, Collapse, Input, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { getKernel, ComponentRegistry, ComponentPropertyRendererRegistry } from '@huahuo/engine';
import PropertyTypeRegistry from './PropertyTypeRegistry';
import { registerDefaultPropertyRenderers } from './defaultPropertyRenderers';
import { registerCustomPropertyRenderers } from './registerCustomPropertyRenderers';

const { Text } = Typography;

// Initialize default property renderers on module load
registerDefaultPropertyRenderers();
registerCustomPropertyRenderers();

interface GameObjectPropertyPanelProps {
  gameObjectId: string;
}

/** A single property row — only re-renders when its value changes */
const PropertyField = memo<{
  goId: string;
  componentType: string;
  propName: string;
  propValue: any;
  onPropertyChange: (compType: string, propName: string, value: any) => void;
}>(({ goId, componentType, propName, propValue, onPropertyChange }) => {
  const handleChange = useCallback((value: any) => {
    onPropertyChange(componentType, propName, value);
  }, [componentType, propName, onPropertyChange]);

  const registry = ComponentRegistry.getInstance();
  const propertyMeta = registry.getPropertyMetadata(componentType, propName);
  const renderer = PropertyTypeRegistry.getInstance().getRenderer(propValue);

  if (!renderer) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <Text style={{ color: '#fff', fontSize: '12px' }}>{propName}</Text>
        <Text style={{ color: '#999', fontSize: '12px', fontStyle: 'italic' }}>
          Unsupported type
        </Text>
      </div>
    );
  }
  return renderer({ propName, propValue, propertyMeta, onChange: handleChange });
}, (p, n) =>
  p.goId === n.goId &&
  p.componentType === n.componentType &&
  p.propName === n.propName &&
  JSON.stringify(p.propValue) === JSON.stringify(n.propValue) &&
  p.onPropertyChange === n.onPropertyChange
);
PropertyField.displayName = 'PropertyField';

/** One component's properties panel */
const ComponentPropertiesPanel = memo<{
  componentType: string;
  props: Record<string, any>;
  goId: string;
  onPropertyChange: (compType: string, propName: string, value: any) => void;
}>(({ componentType, props, goId, onPropertyChange }) => {
  const rendererRegistry = ComponentPropertyRendererRegistry.getInstance();
  const customRenderer = rendererRegistry.getRenderer(componentType);

  if (customRenderer) {
    // Pass a minimal compatible object
    return customRenderer({
      component: { id: `${goId}_${componentType}`, type: componentType, props, parentId: goId, enabled: true, keyFrames: {} },
      gameObjectId: goId,
      onPropertyChange: (compId: string, propName: string, value: any) => onPropertyChange(componentType, propName, value),
    });
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {Object.entries(props).map(([propName, propValue]) => (
        <PropertyField
          key={propName}
          goId={goId}
          componentType={componentType}
          propName={propName}
          propValue={propValue}
          onPropertyChange={onPropertyChange}
        />
      ))}
    </div>
  );
}, (p, n) =>
  p.componentType === n.componentType &&
  p.goId === n.goId &&
  JSON.stringify(p.props) === JSON.stringify(n.props) &&
  p.onPropertyChange === n.onPropertyChange
);
ComponentPropertiesPanel.displayName = 'ComponentPropertiesPanel';

// ── Main panel ────────────────────────────────────────────────────────────────

const GameObjectPropertyPanel: React.FC<GameObjectPropertyPanelProps> = memo(({ gameObjectId }) => {
  const { t } = useTranslation();
  const [goData, setGoData] = useState<any>(null);
  // Map: componentType → props snapshot
  const [componentProps, setComponentProps] = useState<Map<string, Record<string, any>>>(new Map());
  const [componentTypes, setComponentTypes] = useState<string[]>([]);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const prevTypesRef = useRef<string[]>([]);
  // Kernel event subscriptions
  const subIdsRef = useRef<number[]>([]);

  const refreshFromKernel = useCallback(() => {
    const kernel = getKernel();
    if (!kernel.ready) return;

    const go = kernel.getGameObject(gameObjectId);
    if (!go) {
      setGoData(null);
      setComponentProps(new Map());
      setComponentTypes([]);
      return;
    }
    setGoData(go);

    // Read interpolated props for all components at current frame
    const frame = kernel.getPlaybackState()?.current_frame ?? 0;
    const interpolated = kernel.getInterpolatedProps(gameObjectId, frame) ?? {};

    const newMap = new Map<string, Record<string, any>>();
    const newTypes: string[] = [];
    for (const [compType, props] of Object.entries(interpolated)) {
      newMap.set(compType, props as Record<string, any>);
      newTypes.push(compType);
    }
    setComponentProps(newMap);

    const typesChanged =
      newTypes.length !== prevTypesRef.current.length ||
      newTypes.some((t, i) => t !== prevTypesRef.current[i]);

    setComponentTypes(newTypes);
    prevTypesRef.current = newTypes;
    if (typesChanged) setActiveKeys(newTypes);
  }, [gameObjectId]);

  useEffect(() => {
    if (!gameObjectId) {
      setGoData(null);
      setComponentProps(new Map());
      setComponentTypes([]);
      return;
    }

    // Initial read
    refreshFromKernel();

    const kernel = getKernel();
    if (!kernel.ready) return;

    // Subscribe to keyframe changes for this specific GO
    const kfSub = kernel.subscribe(`keyframe/${gameObjectId}/*/*`, () => refreshFromKernel());
    // Subscribe to GO changes (active, name, etc.)
    const goSub = kernel.subscribe(`go/${gameObjectId}`, () => refreshFromKernel());
    // Subscribe to playback frame changes to re-interpolate
    const pbSub = kernel.subscribe('playback/frame_changed', () => refreshFromKernel());

    subIdsRef.current = [kfSub, goSub, pbSub];
    return () => {
      subIdsRef.current.forEach(id => kernel.unsubscribe(id));
      subIdsRef.current = [];
    };
  }, [gameObjectId, refreshFromKernel]);

  const handlePropertyChange = useCallback((componentType: string, propName: string, value: any) => {
    const kernel = getKernel();
    if (!kernel.ready) return;
    const frame = kernel.getPlaybackState()?.current_frame ?? 0;

    // Merge with existing value if both are objects
    const currentProps = componentProps.get(componentType) ?? {};
    const current = currentProps[propName];
    let finalValue = value;
    if (typeof current === 'object' && current !== null && typeof value === 'object' && value !== null) {
      finalValue = { ...current, ...value };
    }

    kernel.setKeyframe(gameObjectId, componentType, propName, frame, finalValue);
  }, [gameObjectId, componentProps]);

  const componentItems = useMemo(() =>
    componentTypes.map(compType => ({
      key: compType,
      label: compType,
      children: (
        <ComponentPropertiesPanel
          key={compType}
          componentType={compType}
          props={componentProps.get(compType) ?? {}}
          goId={gameObjectId}
          onPropertyChange={handlePropertyChange}
        />
      ),
    })),
    [componentTypes, componentProps, gameObjectId, handlePropertyChange]
  );

  if (!goData) {
    return (
      <div className="property-panel" style={{ padding: '12px' }}>
        <Text style={{ color: '#999', fontStyle: 'italic', fontSize: '12px' }}>
          {t('propertyPanel.selectGameObject', 'Select a GameObject to view properties')}
        </Text>
      </div>
    );
  }

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px' };
  const labelStyle: React.CSSProperties = { width: '80px', flexShrink: 0, color: '#999', fontSize: '12px' };

  return (
    <div className="property-panel" style={{ padding: '12px' }}>
      {/* GameObject Name + Active */}
      <div style={rowStyle}>
        <Text style={labelStyle}>Name:</Text>
        <Input
          value={goData.name}
          onChange={(e) => {/* TODO: kernel rename GO */}}
          onKeyDown={(e) => e.stopPropagation()}
          size="small"
          style={{ flex: 1 }}
        />
        <Text style={{ ...labelStyle, width: 'auto', marginLeft: '8px' }}>Active:</Text>
        <Switch
          checked={goData.active}
          onChange={(checked) => getKernel().setGameObjectActive(gameObjectId, checked)}
          size="small"
        />
      </div>

      {/* Components */}
      <div className="property-panel-components">
        {componentTypes.length > 0 ? (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            items={componentItems}
            ghost
            size="small"
            style={{ background: 'transparent' }}
          />
        ) : (
          <Text style={{ color: '#999', fontStyle: 'italic', fontSize: '12px' }}>
            {t('propertyPanel.noComponents')}
          </Text>
        )}
      </div>
    </div>
  );
});

export default GameObjectPropertyPanel;

