import React, { useState, useEffect } from 'react';
import { Tree, Typography } from 'antd';
import type { TreeDataNode } from 'antd';
import { FolderOutlined, FileOutlined, AppstoreOutlined } from '@ant-design/icons';
import { SDK } from '@huahuo/sdk';
import type { IGameObject } from '@huahuo/sdk';
import { store } from '../../store/store'; // Use IDE's merged store
import './HierarchyPanel.css';

const { Title } = Typography;

interface HierarchyPanelProps {
  onSelectGameObject?: (gameObject: IGameObject) => void;
}

const HierarchyPanel: React.FC<HierarchyPanelProps> = ({ onSelectGameObject }) => {
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);

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

    // Build tree data from scene
    const sceneNode: TreeDataNode = {
      title: scene.name,
      key: `scene-${scene.name}`,
      icon: <AppstoreOutlined />,
      children: scene.layers.map((layer, layerIndex) => ({
        title: `${layer.name} (${layer.gameObjects.length})`,
        key: `layer-${layerIndex}`,
        icon: <FolderOutlined />,
        children: layer.gameObjects.map((gameObject, objIndex) => ({
          title: gameObject.name,
          key: `gameobject-${layerIndex}-${objIndex}`,
          icon: <FileOutlined />,
          isLeaf: true,
        })),
      })),
    };

    setTreeData([sceneNode]);
  };

  useEffect(() => {
    refreshHierarchy();

    // Subscribe to Redux store changes (IDE's merged store includes engine state)
    const unsubscribe = store.subscribe(() => {
      refreshHierarchy();
    });

    return () => unsubscribe();
  }, []);

  const onSelect = (selectedKeys: React.Key[], info: any) => {
    setSelectedKeys(selectedKeys);

    // Parse the selected key to find the GameObject
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string;
      if (key.startsWith('gameobject-')) {
        const [, layerIndex, objIndex] = key.split('-').map(Number);
        const scene = SDK.instance.Scene.getCurrentScene();
        if (scene && scene.layers[layerIndex]) {
          const gameObject = scene.layers[layerIndex].gameObjects[objIndex];
          if (gameObject && onSelectGameObject) {
            onSelectGameObject(gameObject);
          }
        }
      }
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
        defaultExpandAll
        selectedKeys={selectedKeys}
        onSelect={onSelect}
        treeData={treeData}
      />
    </div>
  );
};

export default HierarchyPanel;

