import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Select, Collapse, Typography, Space, Tag } from 'antd';
import { EasingType, type AnimationSegment, getKernel } from '@huahuo/engine';

const { Text } = Typography;
const { Option } = Select;

interface AnimationSegmentEditorProps {
  gameObjectId: string;
}

/**
 * Animation Segment Editor
 * Reads keyframe data directly from KernelBridge.
 * Subscribes to keyframe events for the specific GO — no full store diff.
 */
const AnimationSegmentEditorInner: React.FC<AnimationSegmentEditorProps> = ({ gameObjectId }) => {
  const [componentsKeyFrames, setComponentsKeyFrames] = useState<any[]>([]);
  const subIdRef = useRef<number | null>(null);

  const refreshKeyFrames = useCallback(() => {
    const kernel = getKernel();
    if (!kernel.ready) return;
    const go = kernel.getGameObject(gameObjectId);
    if (!go) { setComponentsKeyFrames([]); return; }

    // The Rust GO stores keyframes per component type
    const result: any[] = [];
    for (const [compType, compData] of Object.entries(go.components ?? {})) {
      const cd = compData as any;
      if (compType === 'Timeline') continue;
      if (cd.keyFrames && Object.keys(cd.keyFrames).length > 0) {
        result.push({
          id: `${gameObjectId}_${compType}`,
          type: compType,
          keyFrames: cd.keyFrames,
        });
      }
    }
    setComponentsKeyFrames(result);
  }, [gameObjectId]);

  useEffect(() => {
    if (!gameObjectId) { setComponentsKeyFrames([]); return; }
    refreshKeyFrames();

    const kernel = getKernel();
    if (!kernel.ready) return;

    // Only listen to keyframe events for this specific GO
    subIdRef.current = kernel.subscribe(`keyframe/${gameObjectId}/*/*`, () => refreshKeyFrames());
    return () => {
      if (subIdRef.current !== null) {
        kernel.unsubscribe(subIdRef.current);
        subIdRef.current = null;
      }
    };
  }, [gameObjectId, refreshKeyFrames]);

  const segments = useMemo((): AnimationSegment[] => {
    const result: AnimationSegment[] = [];
    componentsKeyFrames.forEach((component: any) => {
      for (const propertyName in component.keyFrames) {
        const keyFrames = component.keyFrames[propertyName];
        if (!Array.isArray(keyFrames) || keyFrames.length < 2) continue;
        for (let i = 0; i < keyFrames.length - 1; i++) {
          result.push({
            componentId: component.id,
            componentType: component.type,
            propertyName,
            startFrame: keyFrames[i].frame,
            endFrame: keyFrames[i + 1].frame,
            easingType: keyFrames[i + 1].easing ?? EasingType.Linear,
          });
        }
      }
    });
    return result;
  }, [componentsKeyFrames]);

  const groupedSegments = useMemo(() => {
    const groups: Record<string, AnimationSegment[]> = {};
    segments.forEach(s => { (groups[s.componentType] ??= []).push(s); });
    return groups;
  }, [segments]);

  const handleEasingChange = useCallback((segment: AnimationSegment, newEasing: EasingType) => {
    const kernel = getKernel();
    if (!kernel.ready) return;
    // Store easing as part of the keyframe value (the Rust side preserves it)
    kernel.setKeyframe(gameObjectId, segment.componentType, segment.propertyName, segment.endFrame,
      undefined, newEasing);
  }, [gameObjectId]);

  const easingOptions = useMemo(() => [
    { label: 'Linear',      value: EasingType.Linear     },
    { label: 'Ease In',     value: EasingType.EaseIn     },
    { label: 'Ease Out',    value: EasingType.EaseOut    },
    { label: 'Ease In Out', value: EasingType.EaseInOut  },
    { label: 'Custom',      value: EasingType.Custom     },
  ], []);

  const collapseItems = useMemo(() =>
    Object.entries(groupedSegments).map(([compLabel, compSegments]) => ({
      key: compLabel,
      label: (
        <Text strong style={{ fontSize: '12px' }}>
          {compLabel}
          <Tag style={{ marginLeft: '8px', fontSize: '10px' }}>
            {compSegments.length} segment{compSegments.length > 1 ? 's' : ''}
          </Tag>
        </Text>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {compSegments.map(segment => (
            <div
              key={`${segment.componentId}-${segment.propertyName}-${segment.startFrame}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                       padding: '4px 6px', background: '#1a1a1a', borderRadius: '4px', gap: '8px' }}
            >
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <Text style={{ fontSize: '11px', color: '#fff', whiteSpace: 'nowrap' }}>{segment.propertyName}</Text>
                <Text type="secondary" style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>
                  {segment.startFrame + 1}→{segment.endFrame + 1}
                  <span style={{ marginLeft: '4px', color: '#666' }}>
                    ({segment.endFrame - segment.startFrame + 1})
                  </span>
                </Text>
              </div>
              <Select
                value={segment.easingType}
                onChange={v => handleEasingChange(segment, v)}
                style={{ width: '90px', flexShrink: 0 }}
                size="small"
              >
                {easingOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
              </Select>
            </div>
          ))}
        </Space>
      )
    })),
    [groupedSegments, easingOptions, handleEasingChange]
  );

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
      <Collapse ghost defaultActiveKey={Object.keys(groupedSegments)} items={collapseItems} style={{ fontSize: '12px' }} />
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

