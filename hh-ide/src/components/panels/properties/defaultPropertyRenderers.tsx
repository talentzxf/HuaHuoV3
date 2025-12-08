import React from 'react';
import { Typography, Input, InputNumber, Switch } from 'antd';
import PropertyTypeRegistry from './PropertyTypeRegistry';

const { Text } = Typography;

/**
 * Register default property renderers
 * This demonstrates the IoC (Inversion of Control) pattern:
 * - Each renderer registers itself with its own type predicate
 * - The registry doesn't know about specific types
 * - Easy to extend by adding new registrations
 *
 * Performance optimization:
 * - Primitive types (boolean, number, string) use keyGenerator for O(1) Map lookup
 * - Complex types use predicate for flexibility
 */
export function registerDefaultPropertyRenderers(): void {
  const registry = PropertyTypeRegistry.getInstance();

  // Boolean renderer - with keyGenerator for fast lookup
  registry.register(
    // Type predicate
    (value) => typeof value === 'boolean',
    // Renderer function
    ({ propName, propValue, onChange }) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
        <Switch checked={propValue} onChange={onChange} size="small" />
      </div>
    ),
    // Priority: 100 (higher priority for primitive types)
    100,
    // KeyGenerator: generates "boolean" for all boolean values
    (value) => typeof value === 'boolean' ? 'boolean' : null
  );

  // Number renderer - with keyGenerator for fast lookup
  registry.register(
    (value) => typeof value === 'number',
    ({ propName, propValue, propertyMeta, onChange }) => {
      const step = propertyMeta?.step ?? 0.1;
      const precision = propertyMeta?.precision ?? 2;
      const min = propertyMeta?.min;
      const max = propertyMeta?.max;

      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
          <InputNumber
            value={propValue}
            onChange={onChange}
            onKeyDown={(e) => e.stopPropagation()}
            size="small"
            precision={precision}
            step={step}
            min={min}
            max={max}
            style={{ width: '100px' }}
          />
        </div>
      );
    },
    100,
    (value) => typeof value === 'number' ? 'number' : null
  );

  // String renderer - with keyGenerator for fast lookup
  registry.register(
    (value) => typeof value === 'string',
    ({ propName, propValue, onChange }) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
        <Input
          value={propValue}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          size="small"
          style={{ width: '140px' }}
        />
      </div>
    ),
    100,
    (value) => typeof value === 'string' ? 'string' : null
  );

  // Vector/Object renderer (for objects with x, y, z, etc.)
  // Higher priority than generic object renderer
  // No keyGenerator - complex type checking needed
  registry.register(
    (value) => {
      if (typeof value !== 'object' || value === null) return false;
      // Check if it's a vector-like object
      return 'x' in value || 'y' in value || 'z' in value;
    },
    ({ propName, propValue, propertyMeta, onChange }) => {
      const step = propertyMeta?.step ?? 0.1;
      const precision = propertyMeta?.precision ?? 2;

      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Object.entries(propValue).map(([key, val]) => (
              <InputNumber
                key={key}
                value={val as number}
                onChange={(newVal) => {
                  const updatedObj = { ...propValue, [key]: newVal };
                  onChange(updatedObj);
                }}
                onKeyDown={(e) => e.stopPropagation()}
                size="small"
                precision={precision}
                step={step}
                style={{ width: '60px' }}
              />
            ))}
          </div>
        </div>
      );
    },
    50 // Medium priority - before generic object
    // No keyGenerator - each vector instance is different
  );

  // Generic object renderer (fallback for any other object)
  // Lowest priority - only used if no other renderer matches
  registry.register(
    (value) => typeof value === 'object' && value !== null,
    ({ propName, propValue }) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <Text style={{ color: '#ffffff', fontSize: '12px' }}>{propName}</Text>
        <Text style={{ color: '#999999', fontSize: '12px', fontStyle: 'italic' }}>
          {JSON.stringify(propValue)}
        </Text>
      </div>
    ),
    0 // Lowest priority - fallback
    // No keyGenerator - too generic
  );
}

