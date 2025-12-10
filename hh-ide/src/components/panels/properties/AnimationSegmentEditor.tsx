import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Select, Collapse, Typography, Space, Tag } from 'antd';
import { EasingType, type AnimationSegment, getEngineStore, getEngineState, setKeyFrameEasing } from '@huahuo/engine';

const { Text } = Typography;
const { Option } = Select;

interface AnimationSegmentEditorProps {
  gameObjectId: string;
}

// Helper function to extract keyframes data from store (DRY principle)
const extractComponentsKeyFrames = (state: any, gameObjectId: string) => {
  const gameObject = state.gameObjects.byId[gameObjectId];
  if (!gameObject) return [];

  const result = [];
  for (const compId of gameObject.componentIds) {
    const comp = state.components.byId[compId];
    if (comp && comp.type !== 'Timeline') {
      result.push({
        id: comp.id,
        type: comp.type,
        keyFrames: comp.keyFrames
      });
    }
  }
  return result;
};

// Helper function to extract only keyframes for comparison (faster than full object)
const extractKeyFramesOnly = (state: any, gameObjectId: string) => {
  const gameObject = state.gameObjects.byId[gameObjectId];
  if (!gameObject) return [];

  const result = [];
  for (const compId of gameObject.componentIds) {
    const comp = state.components.byId[compId];
    if (comp && comp.type !== 'Timeline') {
      result.push(comp.keyFrames);
    }
  }
  return result;
};

/**
 * Animation Segment Editor
 * Displays all animation segments from all components and allows editing easing per segment
 *
 * Performance optimizations:
 * 1. Manual store subscription (not useSelector) to avoid re-running on every Redux action
 * 2. JSON.stringify comparison (faster than lodash.isEqual for simple data)
 * 3. DRY - extracted duplicate data extraction logic
 * 4. Only compares keyframes (not full component objects)
 */
const AnimationSegmentEditorInner: React.FC<AnimationSegmentEditorProps> = ({
  gameObjectId
}) => {
  // Initialize state without subscribing to Redux
  const [componentsKeyFrames, setComponentsKeyFrames] = useState<any[]>(() => {
    return extractComponentsKeyFrames(getEngineState(), gameObjectId);
  });

  // Subscribe to store changes, but only update when keyframes actually change
  useEffect(() => {
    // Initialize data
    const initialData = extractComponentsKeyFrames(getEngineState(), gameObjectId);
    setComponentsKeyFrames(initialData);

    // Create snapshot for comparison (only keyframes, not full objects)
    let prevSnapshot = JSON.stringify(
      initialData.map(c => c.keyFrames)
    );

    // Subscribe to store
    const store = getEngineStore();
    const unsubscribe = store.subscribe(() => {
      // Extract only keyframes for comparison (faster)
      const currentKeyFrames = extractKeyFramesOnly(getEngineState(), gameObjectId);
      const currentSnapshot = JSON.stringify(currentKeyFrames);

      // Only update if keyframes actually changed
      if (currentSnapshot !== prevSnapshot) {
        prevSnapshot = currentSnapshot;
        setComponentsKeyFrames(extractComponentsKeyFrames(getEngineState(), gameObjectId));
      }
    });

    return () => unsubscribe();
  }, [gameObjectId]);

  // Collect animation segments directly from keyframes data
  const segments = useMemo((): AnimationSegment[] => {
    const result: AnimationSegment[] = [];

    componentsKeyFrames.forEach((component: any) => {
      // Iterate through all properties with keyframes
      for (const propertyName in component.keyFrames) {
        const keyFrames = component.keyFrames[propertyName];
        if (keyFrames.length < 2) continue;

        // Create segments between consecutive keyframes
        for (let i = 0; i < keyFrames.length - 1; i++) {
          const startFrame = keyFrames[i].frame;
          const endFrame = keyFrames[i + 1].frame;
          const easingType = keyFrames[i + 1].easingType || EasingType.Linear;

          result.push({
            componentId: component.id,
            componentType: component.type,
            propertyName,
            startFrame,
            endFrame,
            easingType
          });
        }
      }
    });

    return result;
  }, [componentsKeyFrames]);

  // Group segments by component type
  const groupedSegments = useMemo(() => {
    const groups: Record<string, AnimationSegment[]> = {};
    segments.forEach(segment => {
      const key = segment.componentType;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(segment);
    });
    return groups;
  }, [segments]);

  const handleEasingChange = useCallback((segment: AnimationSegment, newEasing: EasingType) => {
    const store = getEngineStore();
    store.dispatch(setKeyFrameEasing({
      componentId: segment.componentId,
      propName: segment.propertyName,
      frame: segment.endFrame,
      easingType: newEasing
    }));
  }, []);

  const easingOptions = useMemo(() => [
    { label: 'Linear', value: EasingType.Linear },
    { label: 'Ease In', value: EasingType.EaseIn },
    { label: 'Ease Out', value: EasingType.EaseOut },
    { label: 'Ease In Out', value: EasingType.EaseInOut },
    { label: 'Custom', value: EasingType.Custom }
  ], []);

  // Must define collapseItems BEFORE the early return to follow Hooks rules
  const collapseItems = useMemo(() => {
    return Object.entries(groupedSegments).map(([componentLabel, componentSegments]) => ({
      key: componentLabel,
      label: (
        <Text strong style={{ fontSize: '12px' }}>
          {componentLabel}
          <Tag style={{ marginLeft: '8px', fontSize: '10px' }}>
            {componentSegments.length} segment{componentSegments.length > 1 ? 's' : ''}
          </Tag>
        </Text>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {componentSegments.map((segment) => (
            <div
              key={`${segment.componentId}-${segment.propertyName}-${segment.startFrame}-${segment.endFrame}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                background: '#1a1a1a',
                borderRadius: '4px',
                fontSize: '11px'
              }}
            >
              <div style={{ flex: 1 }}>
                <Text style={{ fontSize: '11px', color: '#ffffff' }}>
                  {segment.propertyName}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  Frame {segment.startFrame + 1} → {segment.endFrame + 1}
                  <span style={{ marginLeft: '8px', color: '#666' }}>
                    ({segment.endFrame - segment.startFrame + 1} frames)
                  </span>
                </Text>
              </div>
              <Select
                value={segment.easingType}
                onChange={(value) => handleEasingChange(segment, value)}
                style={{ width: '120px', fontSize: '11px' }}
                size="small"
              >
                {easingOptions.map(opt => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            </div>
          ))}
        </Space>
      )
    }));
  }, [groupedSegments, easingOptions, handleEasingChange]);

  // NOW we can do early return after all hooks are defined
  if (segments.length === 0) {
    return (
      <div style={{ padding: '12px' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          No animation segments found. Add keyframes to create animations.
        </Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <Collapse
        ghost
        defaultActiveKey={Object.keys(groupedSegments)}
        items={collapseItems}
        style={{ fontSize: '12px' }}
      />
    </div>
  );
};

// Wrap with React.memo and use custom comparison
// Only re-render if gameObjectId changes
export const AnimationSegmentEditor = React.memo(
  AnimationSegmentEditorInner,
  (prevProps, nextProps) => {
    // Only re-render if gameObjectId changed
    return prevProps.gameObjectId === nextProps.gameObjectId;
  }
);

