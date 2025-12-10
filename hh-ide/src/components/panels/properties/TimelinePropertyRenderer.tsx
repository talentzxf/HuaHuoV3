import React from 'react';
import { Typography } from 'antd';
import { AnimationSegmentEditor } from './AnimationSegmentEditor';

const { Text } = Typography;

interface TimelinePropertyRendererProps {
  component: any;
  gameObjectId: string;
  onPropertyChange: (componentId: string, propName: string, value: any) => void;
}

/**
 * Custom property renderer for Timeline component
 * Timeline component is just a UI helper - all easing data is stored in keyframes
 */
export const TimelinePropertyRenderer: React.FC<TimelinePropertyRendererProps> = ({
  component,
  gameObjectId,
  onPropertyChange
}) => {
  // No need to monitor store changes here - AnimationSegmentEditor handles it
  return (
    <div style={{ padding: '4px 0' }}>
      {/* Animation Segments */}
      <div style={{ marginBottom: '8px' }}>
        <Text style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>
          Animation Segments
        </Text>
        <Text type="secondary" style={{ display: 'block', fontSize: '10px', marginTop: '4px' }}>
          Configure easing for each animation segment
        </Text>
      </div>

      <AnimationSegmentEditor
        gameObjectId={gameObjectId}
      />
    </div>
  );
};

