import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Tree, Typography } from 'antd';
import type { TreeDataNode } from 'antd';
import { FolderOutlined, FileOutlined, AppstoreOutlined } from '@ant-design/icons';
import { SDK } from '@huahuo/sdk';
import type { IGameObject } from '@huahuo/sdk';
import type { RootState } from '../../store/store';
import { selectObject, clearSelection } from '../../store/features/selection/selectionSlice';
import './HierarchyPanel.css';

const { Title } = Typography;

interface HierarchyPanelProps {
  onSelectGameObject?: (gameObject: IGameObject) => void;
}

const HierarchyPanel: React.FC<HierarchyPanelProps> = ({ onSelectGameObject }) => {
  const dispatch = useDispatch();
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get selection from Redux store
  const selection = useSelector((state: RootState) => state.selection);

  // Subscribe to engine state changes - this will trigger re-render when scene/layers/gameObjects change
  const gameObjectsById = useSelector((state: RootState) => state.engine?.gameObjects?.byId);
  const layersById = useSelector((state: RootState) => state.engine?.layers?.byId);
  const scenesById = useSelector((state: RootState) => state.engine?.scenes?.byId);

  // Use useMemo to build tree data and ID mappings - only rebuild when engine state changes
  const { treeData, gameObjectIdToKey, layerIdToKey, sceneIdToKey } = useMemo(() => {
    if (!SDK.isInitialized()) {
      return {
        treeData: [],
        gameObjectIdToKey: new Map<string, string>(),
        layerIdToKey: new Map<string, string>(),
        sceneIdToKey: new Map<string, string>(),
      };
    }

    const scene = SDK.instance.Scene.getCurrentScene();
    if (!scene) {
      return {
        treeData: [],
        gameObjectIdToKey: new Map<string, string>(),
        layerIdToKey: new Map<string, string>(),
        sceneIdToKey: new Map<string, string>(),
      };
    }

    // Build GameObject ID to key mapping, Layer ID to key mapping, and Scene ID to key mapping
    const idToKeyMap = new Map<string, string>();
    const layerToKeyMap = new Map<string, string>();
    const sceneToKeyMap = new Map<string, string>();

    const sceneKey = `scene-${scene.name}`;
    sceneToKeyMap.set(scene.id, sceneKey);

    // Build tree data from scene
    const sceneNode: TreeDataNode = {
      title: scene.name,
      key: sceneKey,
      icon: <AppstoreOutlined />,
      children: scene.layers.map((layer, layerIndex) => {
        const layerKey = `layer-${layerIndex}`;
        layerToKeyMap.set(layer.id, layerKey);
        return {
          title: `${layer.name} (${layer.gameObjects.length})`,
          key: layerKey,
          icon: <FolderOutlined />,
          children: layer.gameObjects.map((gameObject, objIndex) => {
            const key = `gameobject-${layerIndex}-${objIndex}`;
            idToKeyMap.set(gameObject.id, key);
            return {
              title: gameObject.name,
              key: key,
              icon: <FileOutlined />,
              isLeaf: true,
            };
          }),
        };
      }),
    };

    return {
      treeData: [sceneNode],
      gameObjectIdToKey: idToKeyMap,
      layerIdToKey: layerToKeyMap,
      sceneIdToKey: sceneToKeyMap,
    };
  }, [gameObjectsById, layersById, scenesById]); // Only rebuild when engine state changes

  // Calculate selectedKeys from selection state
  const selectedKeys = useMemo(() => {
    if (selection.selectedType === 'scene' && selection.selectedId && sceneIdToKey.has(selection.selectedId)) {
      return [sceneIdToKey.get(selection.selectedId)!];
    }
    if (selection.selectedType === 'gameObject' && selection.selectedId && gameObjectIdToKey.has(selection.selectedId)) {
      return [gameObjectIdToKey.get(selection.selectedId)!];
    }
    if (selection.selectedType === 'layer' && selection.selectedId && layerIdToKey.has(selection.selectedId)) {
      return [layerIdToKey.get(selection.selectedId)!];
    }
    return [];
  }, [selection, gameObjectIdToKey, layerIdToKey, sceneIdToKey]);

  // Initialize expanded keys on mount
  useEffect(() => {
    if (!isInitialized) {
      SDK.executeAfterInit(() => {
        const scene = SDK.instance.Scene.getCurrentScene();
        if (scene) {
          // Auto-expand scene and all layers initially
          const initialExpandedKeys: React.Key[] = [`scene-${scene.name}`];
          scene.layers.forEach((layer, layerIndex) => {
            initialExpandedKeys.push(`layer-${layerIndex}`);
          });
          setExpandedKeys(initialExpandedKeys);
          setIsInitialized(true);
        }
      });
    }
  }, [isInitialized]);

  // Memoize the select handler
  const onSelect = useCallback((keys: React.Key[]) => {
    if (!SDK.isInitialized()) return;

    const scene = SDK.instance.Scene.getCurrentScene();
    if (!scene) return;

    // Auto-expand all nodes when clicking
    const allExpandedKeys: React.Key[] = [`scene-${scene.name}`];
    scene.layers.forEach((layer, layerIndex) => {
      allExpandedKeys.push(`layer-${layerIndex}`);
    });
    setExpandedKeys(allExpandedKeys);

    // Parse the selected key to find the GameObject, Layer, or Scene
    if (keys.length > 0) {
      const key = keys[0] as string;

      // Handle Scene selection
      if (key.startsWith('scene-')) {
        dispatch(selectObject({ type: 'scene', id: scene.id }));
        console.log('Selected Scene:', scene.id);
      }
      // Handle GameObject selection
      else if (key.startsWith('gameobject-')) {
        const [, layerIndex, objIndex] = key.split('-').map(Number);
        if (scene.layers[layerIndex]) {
          const gameObject = scene.layers[layerIndex].gameObjects[objIndex];
          if (gameObject) {
            dispatch(selectObject({ type: 'gameObject', id: gameObject.id }));

            if (onSelectGameObject) {
              onSelectGameObject(gameObject);
            }
          }
        }
      }
      // Handle Layer selection
      else if (key.startsWith('layer-')) {
        const layerIndex = parseInt(key.split('-')[1]);
        if (scene.layers[layerIndex]) {
          const layer = scene.layers[layerIndex];
          dispatch(selectObject({ type: 'layer', id: layer.id }));
          console.log('Selected Layer:', layer.id);
        }
      }
    } else {
      // Clear selection if nothing is selected
      dispatch(clearSelection());
    }
  }, [dispatch, onSelectGameObject]);

  // Memoize expand handler
  const onExpand = useCallback((keys: React.Key[]) => {
    setExpandedKeys(keys);
  }, []);

  return (
    <div style={{
      padding: '12px',
      height: '100%',
      overflow: 'auto',
      background: '#1e1e1e',
      color: '#e8e8e8'
    }}>
      <Title level={5} style={{ color: '#e8e8e8', margin: '0 0 12px 0' }}>
        Hierarchy
      </Title>
      <Tree
        className="hierarchy-tree"
        showIcon
        expandedKeys={expandedKeys}
        onExpand={onExpand}
        selectedKeys={selectedKeys}
        onSelect={onSelect}
        treeData={treeData}
      />
    </div>
  );
};

export default HierarchyPanel;

