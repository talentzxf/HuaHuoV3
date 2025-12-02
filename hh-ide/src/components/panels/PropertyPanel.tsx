import React, { useState, useEffect } from 'react';
import { Typography, Collapse, Input, InputNumber, Switch } from 'antd';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../store/store';
import { SDK, getEngineStore, getEngineState, ComponentRegistry } from '@huahuo/sdk';
import type { ComponentSlice } from '@huahuo/sdk';
import './PropertyPanel.css';

const { Text } = Typography;

interface PropertyPanelProps {}

const PropertyPanel: React.FC<PropertyPanelProps> = () => {
    const { t } = useTranslation();
    const selectedGameObjectId = useSelector((state: RootState) => state.selection.selectedGameObjectId);
    const [gameObjectData, setGameObjectData] = useState<any>(null);
    const [components, setComponents] = useState<ComponentSlice[]>([]);

    useEffect(() => {
        console.debug('[PropertyPanel] selectedGameObjectId changed:', selectedGameObjectId);
        console.debug('[PropertyPanel] SDK initialized:', SDK.isInitialized());

        if (!selectedGameObjectId || !SDK.isInitialized()) {
            setGameObjectData(null);
            setComponents([]);
            return;
        }

        const updateData = () => {
            // Get GameObject data from engine state
            const state = getEngineState();
            console.debug('[PropertyPanel] Engine state:', state);
            const gameObject = state.gameObjects.byId[selectedGameObjectId];
            console.debug('[PropertyPanel] GameObject data:', gameObject);

            if (!gameObject) {
                setGameObjectData(null);
                setComponents([]);
                return;
            }

            setGameObjectData(gameObject);

            // Get all components for this GameObject
            const gameObjectComponents = gameObject.componentIds
                .map((compId: string) => state.components.byId[compId])
                .filter(Boolean);

            console.debug('[PropertyPanel] Components:', gameObjectComponents);
            setComponents(gameObjectComponents);
        };

        updateData();

        // Subscribe to store changes to refresh the property panel
        const store = getEngineStore();
        const unsubscribe = store.subscribe(() => {
            updateData();
        });

        return () => unsubscribe();
    }, [selectedGameObjectId]);

    const handlePropertyChange = (componentId: string, propName: string, value: any) => {
        console.debug('[PropertyPanel] handlePropertyChange:', { componentId, propName, value });

        // Update component property through engine store
        if (SDK.isInitialized()) {
            const store = getEngineStore();
            const state = getEngineState();

            // Get current component to check if we're updating a nested property
            const component = state.components.byId[componentId];
            if (!component) {
                console.warn('[PropertyPanel] Component not found:', componentId);
                return;
            }

            // For nested objects (like position, scale), we need to merge the values
            // because the value passed might be the entire object
            const currentPropValue = component.props[propName];
            let finalValue = value;

            // If current value is an object and new value is also an object, merge them
            if (typeof currentPropValue === 'object' && currentPropValue !== null &&
                typeof value === 'object' && value !== null) {
                finalValue = { ...currentPropValue, ...value };
            }

            console.debug('[PropertyPanel] Dispatching update:',
                componentId,
                component.type,
                propName,
                'current:', JSON.stringify(currentPropValue),
                'new:', JSON.stringify(value),
                'final:', JSON.stringify(finalValue)
            );

            // Dispatch using the proper Redux action
            store.dispatch({
                type: 'components/updateComponentProps',
                payload: {
                    id: componentId,
                    patch: { [propName]: finalValue }
                }
            });

            // Verify the update
            const updatedComponent = getEngineState().components.byId[componentId];
            console.debug('[PropertyPanel] After dispatch, component:', componentId, 'props:', JSON.stringify(updatedComponent?.props));
        }
    };

    const renderPropertyField = (componentId: string, componentType: string, propName: string, propValue: any) => {
        const handleChange = (value: any) => {
            handlePropertyChange(componentId, propName, value);
        };

        // Get property metadata from ComponentRegistry
        const registry = ComponentRegistry.getInstance();
        const propertyMeta = registry.getPropertyMetadata(componentType, propName);

        console.debug(`[PropertyPanel] Getting metadata for ${componentType}.${propName}:`, propertyMeta);

        // Use metadata or defaults
        const step = propertyMeta?.step ?? 0.1;
        const precision = propertyMeta?.precision ?? 2;
        const min = propertyMeta?.min;
        const max = propertyMeta?.max;

        // Handle different types of properties
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
            // Handle nested objects (like position, scale, etc.) - all values in one line
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

        // Default: display as JSON string
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
                <Text style={{ color: '#aaaaaa', fontSize: '11px' }}>{JSON.stringify(propValue)}</Text>
            </div>
        );
    };

    const renderComponent = (component: ComponentSlice) => {
        return {
            key: component.id,
            label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ color: '#ffffff', fontSize: '13px' }}>{component.type}</Text>
                    <Switch
                        checked={component.enabled}
                        onChange={(checked) => {
                            if (SDK.isInitialized()) {
                                const store = getEngineStore();
                                store.dispatch({
                                    type: 'components/setComponentEnabled',
                                    payload: { id: component.id, enabled: checked }
                                });
                            }
                        }}
                        size="small"
                        onClick={(_, e) => e.stopPropagation()}
                    />
                </div>
            ),
            children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {Object.entries(component.props).map(([propName, propValue]) => (
                        <div key={propName}>
                            {renderPropertyField(component.id, component.type, propName, propValue)}
                        </div>
                    ))}
                    {Object.keys(component.props).length === 0 && (
                        <Text style={{ color: '#999999', fontStyle: 'italic', fontSize: '12px' }}>{t('propertyPanel.noProperties')}</Text>
                    )}
                </div>
            )
        };
    };

    if (!selectedGameObjectId) {
        return (
            <div className="property-panel-empty">
                <Text style={{ color: '#888888' }}>{t('propertyPanel.selectGameObject')}</Text>
            </div>
        );
    }

    if (!gameObjectData) {
        return (
            <div className="property-panel-empty">
                <Text style={{ color: '#888888' }}>{t('propertyPanel.gameObjectNotFound')}</Text>
            </div>
        );
    }

    return (
        <div className="property-panel">
            <div className="property-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Input
                        value={gameObjectData.name}
                        onChange={(e) => {
                            if (SDK.isInitialized()) {
                                const store = getEngineStore();
                                store.dispatch({
                                    type: 'gameObjects/renameGameObject',
                                    payload: { id: selectedGameObjectId, name: e.target.value }
                                });
                            }
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        size="small"
                        style={{ flex: 1 }}
                    />
                    <Switch
                        size="small"
                        checked={gameObjectData.active}
                        onChange={(checked) => {
                            if (SDK.isInitialized()) {
                                const store = getEngineStore();
                                store.dispatch({
                                    type: 'gameObjects/setGameObjectActive',
                                    payload: { id: selectedGameObjectId, active: checked }
                                });
                            }
                        }}
                    />
                </div>
            </div>

            <div className="property-panel-components">
                {components.length > 0 ? (
                    <Collapse
                        defaultActiveKey={components.map(c => c.id)}
                        items={components.map(renderComponent)}
                        ghost
                        size="small"
                        style={{ background: 'transparent' }}
                    />
                ) : (
                    <Text style={{ color: '#999999', fontStyle: 'italic', fontSize: '12px' }}>{t('propertyPanel.noComponents')}</Text>
                )}
            </div>
        </div>
    );
};

export default PropertyPanel;


