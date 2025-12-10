import React, { useMemo } from 'react';
import { Select, Collapse, Typography, Space, Tag } from 'antd';
import { EasingType, type AnimationSegment } from '@huahuo/engine';
import { useSelector, shallowEqual } from 'react-redux';
import { getEngineStore } from '@huahuo/engine';
import { setKeyFrameEasing } from '@huahuo/engine';

const { Text } = Typography;
const { Option } = Select;

interface AnimationSegmentEditorProps {
  gameObjectId: string;
}

/**
 * Animation Segment Editor
 * Displays all animation segments from all components and allows editing easing per segment
 */
export const AnimationSegmentEditor: React.FC<AnimationSegmentEditorProps> = ({
  gameObjectId
}) => {
  // Use Redux selector to only listen to this GameObject's components
  // Use shallowEqual to prevent unnecessary rerenders when array contents haven't changed
  const components = useSelector((state: any) => {
    const engineState = state.engine || state;
    const gameObject = engineState.gameObjects.byId[gameObjectId];
    if (!gameObject) return [];

    // Get all components for this GameObject
    return gameObject.componentIds
      .map((compId: string) => engineState.components.byId[compId])
      .filter((comp: any) => comp && comp.type !== 'Timeline'); // Exclude Timeline itself
  }, shallowEqual); // Use shallowEqual to compare array contents

  // Collect animation segments directly from components data
  const segments = useMemo((): AnimationSegment[] => {
    const result: AnimationSegment[] = [];

    components.forEach((component: any) => {
      // Iterate through all properties with keyframes
      for (const propertyName in component.keyFrames) {
        const keyFrames = component.keyFrames[propertyName];
        if (keyFrames.length < 2) continue; // Need at least 2 keyframes to make a segment

        // Create segments between consecutive keyframes
        for (let i = 0; i < keyFrames.length - 1; i++) {
          const startFrame = keyFrames[i].frame;
          const endFrame = keyFrames[i + 1].frame;

          // Easing is stored on the END keyframe (easing TO that keyframe)
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
  }, [components]);

  // Group segments by component type
  const groupedSegments = useMemo(() => {
    const groups: Record<string, AnimationSegment[]> = {};
    segments.forEach(segment => {
      const key = `${segment.componentType} (${segment.componentId.substring(0, 8)})`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(segment);
    });
    return groups;
  }, [segments]);

  const handleEasingChange = (segment: AnimationSegment, newEasing: EasingType) => {
    const store = getEngineStore();

    // Set easing on the END keyframe (easing TO that keyframe)
    store.dispatch(setKeyFrameEasing({
      componentId: segment.componentId,
      propName: segment.propertyName,
      frame: segment.endFrame,
      easingType: newEasing
    }));

    // Redux will automatically trigger re-render via useSelector
  };

  const easingOptions = [
    { label: 'Linear', value: EasingType.Linear },
    { label: 'Ease In', value: EasingType.EaseIn },
    { label: 'Ease Out', value: EasingType.EaseOut },
    { label: 'Ease In Out', value: EasingType.EaseInOut },
    { label: 'Custom', value: EasingType.Custom }
  ];

  if (segments.length === 0) {
    return (
      <div style={{ padding: '12px' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          No animation segments found. Add keyframes to create animations.
        </Text>
      </div>
    );
  }

  // Build items array for Collapse component
  const collapseItems = Object.entries(groupedSegments).map(([componentLabel, componentSegments]) => ({
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
                Frame {segment.startFrame} → {segment.endFrame}
                <span style={{ marginLeft: '8px', color: '#666' }}>
                  ({segment.endFrame - segment.startFrame} frames)
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

