import React, { useState, useEffect } from 'react';
import { Typography, Collapse, Input, InputNumber, Switch, Divider, Space } from 'antd';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../store/store';
import { SDK, getEngineStore, getEngineState } from '@huahuo/sdk';
import type { ComponentSlice } from '@huahuo/sdk';
import './PropertyPanel.css';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface PropertyPanelProps {}

const PropertyPanel: React.FC<PropertyPanelProps> = () => {
    const { t } = useTranslation();
    const selectedGameObjectId = useSelector((state: RootState) => state.selection.selectedGameObjectId);
    const [gameObjectData, setGameObjectData] = useState<any>(null);
    const [components, setComponents] = useState<ComponentSlice[]>([]);

    useEffect(() => {
        console.log('[PropertyPanel] selectedGameObjectId changed:', selectedGameObjectId);
        console.log('[PropertyPanel] SDK initialized:', SDK.isInitialized());

        if (!selectedGameObjectId || !SDK.isInitialized()) {
            setGameObjectData(null);
            setComponents([]);
            return;
        }

        const updateData = () => {
            // Get GameObject data from engine state
            const state = getEngineState();
            console.log('[PropertyPanel] Engine state:', state);
            const gameObject = state.gameObjects.byId[selectedGameObjectId];
            console.log('[PropertyPanel] GameObject data:', gameObject);

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

            console.log('[PropertyPanel] Components:', gameObjectComponents);
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
        // Update component property through engine store
        if (SDK.isInitialized()) {
            const store = getEngineStore();
            store.dispatch({
                type: 'components/updateComponentProps',
                payload: {
                    id: componentId,
                    patch: { [propName]: value }
                }
            });
        }
    };

    const renderPropertyField = (componentId: string, propName: string, propValue: any) => {
        const handleChange = (value: any) => {
            handlePropertyChange(componentId, propName, value);
        };

        // Handle different types of properties
        if (typeof propValue === 'boolean') {
            return (
                <Space>
                    <Text style={{ color: '#cccccc', minWidth: '100px' }}>{propName}:</Text>
                    <Switch checked={propValue} onChange={handleChange} size="small" />
                </Space>
            );
        } else if (typeof propValue === 'number') {
            return (
                <Space>
                    <Text style={{ color: '#cccccc', minWidth: '100px' }}>{propName}:</Text>
                    <InputNumber
                        value={propValue}
                        onChange={handleChange}
                        size="small"
                        style={{ width: '150px' }}
                    />
                </Space>
            );
        } else if (typeof propValue === 'string') {
            return (
                <Space>
                    <Text style={{ color: '#cccccc', minWidth: '100px' }}>{propName}:</Text>
                    <Input
                        value={propValue}
                        onChange={(e) => handleChange(e.target.value)}
                        size="small"
                        style={{ width: '150px' }}
                    />
                </Space>
            );
        } else if (typeof propValue === 'object' && propValue !== null) {
            // Handle nested objects (like position, scale, etc.)
            return (
                <div>
                    <Text style={{ color: '#cccccc', display: 'block', marginBottom: '4px' }}>{propName}:</Text>
                    <div style={{ paddingLeft: '12px' }}>
                        {Object.entries(propValue).map(([key, val]) => (
                            <Space key={key} style={{ marginBottom: '4px' }}>
                                <Text style={{ color: '#aaaaaa', minWidth: '40px' }}>{key}:</Text>
                                <InputNumber
                                    value={val as number}
                                    onChange={(newVal) => {
                                        const updatedObj = { ...propValue, [key]: newVal };
                                        handleChange(updatedObj);
                                    }}
                                    size="small"
                                    style={{ width: '100px' }}
                                />
                            </Space>
                        ))}
                    </div>
                </div>
            );
        }

        // Default: display as JSON string
        return (
            <Space>
                <Text style={{ color: '#cccccc', minWidth: '100px' }}>{propName}:</Text>
                <Text style={{ color: '#888888' }}>{JSON.stringify(propValue)}</Text>
            </Space>
        );
    };

    const renderComponent = (component: ComponentSlice) => {
        return (
            <Panel
                header={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ color: '#e8e8e8' }}>{component.type}</Text>
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
                }
                key={component.id}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(component.props).map(([propName, propValue]) => (
                        <div key={propName}>
                            {renderPropertyField(component.id, propName, propValue)}
                        </div>
                    ))}
                    {Object.keys(component.props).length === 0 && (
                        <Text style={{ color: '#888888', fontStyle: 'italic' }}>{t('propertyPanel.noProperties')}</Text>
                    )}
                </div>
            </Panel>
        );
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
                <Title level={5} style={{ color: '#e8e8e8', margin: '0 0 8px 0' }}>
                    {t('propertyPanel.inspector')}
                </Title>
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
                    size="large"
                    style={{ marginBottom: '8px' }}
                />
                <Space>
                    <Text style={{ color: '#cccccc' }}>{t('propertyPanel.active')}:</Text>
                    <Switch
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
                </Space>
            </div>

            <Divider style={{ margin: '12px 0', borderColor: '#444' }} />

            <div className="property-panel-components">
                {components.length > 0 ? (
                    <Collapse
                        defaultActiveKey={components.map(c => c.id)}
                        ghost
                        style={{ background: 'transparent' }}
                    >
                        {components.map(renderComponent)}
                    </Collapse>
                ) : (
                    <Text style={{ color: '#888888', fontStyle: 'italic' }}>{t('propertyPanel.noComponents')}</Text>
                )}
            </div>
        </div>
    );
};

export default PropertyPanel;

