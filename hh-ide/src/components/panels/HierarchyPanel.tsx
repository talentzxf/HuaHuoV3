import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Tree, Typography } from 'antd';
import type { TreeDataNode } from 'antd';
import { FolderOutlined, FileOutlined, AppstoreOutlined } from '@ant-design/icons';
import { SDK } from '@huahuo/sdk';
import type { IGameObject, ILayer } from '@huahuo/sdk';
import type { RootState } from '../../store/store';
import { store } from '../../store/store';
import { selectObject, clearSelection } from '../../store/features/selection/selectionSlice';
import './HierarchyPanel.css';

const { Title } = Typography;

interface HierarchyPanelProps {
  onSelectGameObject?: (gameObject: IGameObject) => void;
}

const HierarchyPanel: React.FC<HierarchyPanelProps> = ({ onSelectGameObject }) => {
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [gameObjectCount, setGameObjectCount] = useState<number>(0);

  // Get selection from Redux store
  const selection = useSelector((state: RootState) => state.selection);

  // Map GameObject ID, Layer ID, and Scene ID to tree key
  const [gameObjectIdToKey, setGameObjectIdToKey] = useState<Map<string, string>>(new Map());
  const [layerIdToKey, setLayerIdToKey] = useState<Map<string, string>>(new Map());
  const [sceneIdToKey, setSceneIdToKey] = useState<Map<string, string>>(new Map());

  // Calculate selectedKeys from selection state
  const selectedKeys = React.useMemo(() => {
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

  const refreshHierarchy = () => {
    if (!SDK.isInitialized()) {
      setTreeData([]);
      return;
    }

    const scene = SDK.instance.Scene.getCurrentScene();
    if (!scene) {
      setTreeData([]);
      return;
    }

    // Count total GameObjects
    const totalGameObjects = scene.layers.reduce((sum, layer) => sum + layer.gameObjects.length, 0);

    // If GameObject count increased, auto-expand the affected layers
    if (totalGameObjects > gameObjectCount) {
      const newExpandedKeys: React.Key[] = [`scene-${scene.name}`];
      scene.layers.forEach((layer, layerIndex) => {
        if (layer.gameObjects.length > 0) {
          newExpandedKeys.push(`layer-${layerIndex}`);
        }
      });
      setExpandedKeys(newExpandedKeys);
      setGameObjectCount(totalGameObjects);
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

    setTreeData([sceneNode]);
    setGameObjectIdToKey(idToKeyMap);
    setLayerIdToKey(layerToKeyMap);
    setSceneIdToKey(sceneToKeyMap);
  };

  useEffect(() => {
    // Initial load: expand all nodes
    if (SDK.isInitialized()) {
      const scene = SDK.instance.Scene.getCurrentScene();
      if (scene) {
        const initialExpandedKeys: React.Key[] = [`scene-${scene.name}`];
        scene.layers.forEach((layer, layerIndex) => {
          initialExpandedKeys.push(`layer-${layerIndex}`);
        });
        setExpandedKeys(initialExpandedKeys);

        // Set initial count
        const totalGameObjects = scene.layers.reduce((sum, layer) => sum + layer.gameObjects.length, 0);
        setGameObjectCount(totalGameObjects);
      }
    }

    refreshHierarchy();

    // Subscribe to Redux store changes (IDE's merged store includes engine state)
    const unsubscribe = store.subscribe(() => {
      refreshHierarchy();
    });

    return () => unsubscribe();
  }, []);

  const onSelect = (keys: React.Key[]) => {
    // Auto-expand all nodes when clicking
    const scene = SDK.instance.Scene.getCurrentScene();
    if (scene) {
      const allExpandedKeys: React.Key[] = [`scene-${scene.name}`];
      scene.layers.forEach((layer, layerIndex) => {
        allExpandedKeys.push(`layer-${layerIndex}`);
      });
      setExpandedKeys(allExpandedKeys);
    }

    // Parse the selected key to find the GameObject, Layer, or Scene
    if (keys.length > 0) {
      const key = keys[0] as string;

      // Handle Scene selection
      if (key.startsWith('scene-')) {
        if (scene) {
          store.dispatch(selectObject({ type: 'scene', id: scene.id }));
          console.log('Selected Scene:', scene.id);
        }
      }
      // Handle GameObject selection
      else if (key.startsWith('gameobject-')) {
        const [, layerIndex, objIndex] = key.split('-').map(Number);
        if (scene && scene.layers[layerIndex]) {
          const gameObject = scene.layers[layerIndex].gameObjects[objIndex];
          if (gameObject) {
            store.dispatch(selectObject({ type: 'gameObject', id: gameObject.id }));

            if (onSelectGameObject) {
              onSelectGameObject(gameObject);
            }
          }
        }
      }
      // Handle Layer selection
      else if (key.startsWith('layer-')) {
        const layerIndex = parseInt(key.split('-')[1]);
        if (scene && scene.layers[layerIndex]) {
          const layer = scene.layers[layerIndex];
          store.dispatch(selectObject({ type: 'layer', id: layer.id }));
          console.log('Selected Layer:', layer.id);
        }
      }
    } else {
      // Clear selection if nothing is selected
      store.dispatch(clearSelection());
    }
  };

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
        onExpand={(keys) => setExpandedKeys(keys)}
        selectedKeys={selectedKeys}
        onSelect={onSelect}
        treeData={treeData}
      />
    </div>
  );
};

export default HierarchyPanel;

