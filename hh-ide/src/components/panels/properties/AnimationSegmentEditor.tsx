import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Select, Collapse, Typography, Space, Tag } from 'antd';
import { EasingType, type AnimationSegment, getEngineStore, getEngineState, setKeyFrameEasing } from '@huahuo/engine';
import { subscribeToKeyframeChanges } from '../../../store/listeners/keyframeListener';

const { Text } = Typography;
const { Option } = Select;

interface AnimationSegmentEditorProps {
  gameObjectId: string;
}

// Helper function to extract keyframes data from store
const extractComponentsKeyFrames = (gameObjectId: string) => {
  const state = getEngineState();
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

/**
 * Animation Segment Editor
 * Displays all animation segments from all components and allows editing easing per segment
 *
 * Performance: Uses Redux Toolkit Listener Middleware
 * - Only updates when keyframe-related actions are dispatched
 * - Ignores all other actions (drag, playback, selection, etc.)
 * 2. JSON.stringify comparison (faster than lodash.isEqual for simple data)
 * 3. DRY - extracted duplicate data extraction logic
 * 4. Only compares keyframes (not full component objects)
 */
const AnimationSegmentEditorInner: React.FC<AnimationSegmentEditorProps> = ({
  gameObjectId
}) => {
  // State to hold keyframes data
  const [componentsKeyFrames, setComponentsKeyFrames] = useState<any[]>(() =>
    extractComponentsKeyFrames(gameObjectId)
  );

  // Subscribe to keyframe changes via listener middleware
  useEffect(() => {
    // Update on mount
    setComponentsKeyFrames(extractComponentsKeyFrames(gameObjectId));

    // Subscribe to keyframe changes
    // ✅ Only triggers on keyframe-related actions (setPropertyKeyFrame, etc.)
    // ❌ Ignores all other actions (updateComponentProps, playback, etc.)
    const unsubscribe = subscribeToKeyframeChanges((changedGameObjectId) => {
      // Only update if this is our GameObject
      if (changedGameObjectId === gameObjectId) {
        setComponentsKeyFrames(extractComponentsKeyFrames(gameObjectId));
      }
    });

    return unsubscribe;
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
                padding: '4px 6px',
                background: '#1a1a1a',
                borderRadius: '4px',
                fontSize: '10px',
                gap: '8px'
              }}
            >
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <Text style={{ fontSize: '11px', color: '#ffffff', whiteSpace: 'nowrap' }}>
                  {segment.propertyName}
                </Text>
                <Text type="secondary" style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>
                  {segment.startFrame + 1}→{segment.endFrame + 1}
                  <span style={{ marginLeft: '4px', color: '#666' }}>
                    ({segment.endFrame - segment.startFrame + 1})
                  </span>
                </Text>
              </div>
              <Select
                value={segment.easingType}
                onChange={(value) => handleEasingChange(segment, value)}
                style={{ width: '90px', fontSize: '10px', flexShrink: 0 }}
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

