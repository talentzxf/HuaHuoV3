import React from 'react';
import { useSelector } from 'react-redux';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../store/store';
import { PropertyBuilderFactory } from './properties/PropertyBuilderFactory';
import './PropertyPanel.css';

const { Text } = Typography;

/**
 * PropertyPanel - Clean and extensible property panel
 * Uses Factory pattern to delegate rendering to specific property builders
 */
const PropertyPanel: React.FC = () => {
  const { t } = useTranslation();
  const selection = useSelector((state: RootState) => state.selection);
  const factory = PropertyBuilderFactory.getInstance();

  // No selection
  if (!selection.selectedType || !selection.selectedId) {
    return (
      <div className="property-panel">
        <Text style={{ color: '#999999', fontStyle: 'italic', fontSize: '12px' }}>
          {t('propertyPanel.noSelection', 'Select an object to view properties')}
        </Text>
      </div>
    );
  }

  // Get appropriate builder for the selected type
  const builder = factory.getBuilder(selection.selectedType);

  if (!builder) {
    return (
      <div className="property-panel">
        <Text style={{ color: '#ff4d4f', fontSize: '12px' }}>
          {t('propertyPanel.unsupportedType', 'Unsupported selection type')}: {selection.selectedType}
        </Text>
      </div>
    );
  }

  // Delegate rendering to the specific builder
  return builder.buildPropertyPanel(selection.selectedId);
};

export default PropertyPanel;

