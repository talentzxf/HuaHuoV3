import React from 'react';
import { Typography, Input, InputNumber, Switch } from 'antd';

const { Text } = Typography;

export interface PropertyRendererProps {
  propName: string;
  propValue: any;
  propertyMeta?: any;
  onChange: (value: any) => void;
}

export type PropertyRenderer = (props: PropertyRendererProps) => React.ReactElement | null;

// Type predicate function - determines if a renderer can handle a value
export type TypePredicate = (propValue: any) => boolean;

// Type key function - generates a cache key for a value (for Map lookup)
export type TypeKeyGenerator = (propValue: any) => string | null;

interface RendererEntry {
  predicate: TypePredicate;
  renderer: PropertyRenderer;
  priority: number;
  keyGenerator?: TypeKeyGenerator; // Optional: for Map caching
}

// Registry for property type renderers using IoC pattern
class PropertyTypeRegistry {
  private static instance: PropertyTypeRegistry;

  // Two-tier lookup system:
  // 1. Fast Map lookup for common types (O(1))
  private typeCache: Map<string, PropertyRenderer> = new Map();

  // 2. Predicate array for complex types (O(n))
  private predicateRenderers: RendererEntry[] = [];

  private constructor() {
    // Don't register anything by default - let external code register
  }

  static getInstance(): PropertyTypeRegistry {
    if (!PropertyTypeRegistry.instance) {
      PropertyTypeRegistry.instance = new PropertyTypeRegistry();
    }
    return PropertyTypeRegistry.instance;
  }

  /**
   * Register a custom renderer with a type predicate (IoC pattern)
   * @param predicate - Function that returns true if this renderer can handle the value
   * @param renderer - The renderer function
   * @param priority - Higher priority renderers are checked first (default: 0)
   * @param keyGenerator - Optional: generates a cache key for Map lookup (for performance)
   */
  register(
    predicate: TypePredicate,
    renderer: PropertyRenderer,
    priority: number = 0,
    keyGenerator?: TypeKeyGenerator
  ): void {
    this.predicateRenderers.push({ predicate, renderer, priority, keyGenerator });
    // Sort by priority (higher first)
    this.predicateRenderers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Register a renderer for a specific type key (fast Map lookup)
   * Use this for simple, common types like 'boolean', 'number', 'string'
   */
  registerByTypeKey(typeKey: string, renderer: PropertyRenderer): void {
    this.typeCache.set(typeKey, renderer);
  }

  /**
   * Get renderer for a property value
   * Uses two-tier lookup:
   * 1. Try cache (Map) first - O(1)
   * 2. Fall back to predicate iteration - O(n)
   */
  getRenderer(propValue: any): PropertyRenderer | null {
    // Tier 1: Try to generate a cache key and lookup in Map
    for (const entry of this.predicateRenderers) {
      if (entry.keyGenerator) {
        const cacheKey = entry.keyGenerator(propValue);
        if (cacheKey) {
          // Check if already cached
          let cached = this.typeCache.get(cacheKey);
          if (cached) {
            return cached;
          }

          // Check if predicate matches, then cache it
          if (entry.predicate(propValue)) {
            this.typeCache.set(cacheKey, entry.renderer);
            return entry.renderer;
          }
        }
      }
    }

    // Tier 2: Fall back to predicate iteration (for complex types)
    for (const entry of this.predicateRenderers) {
      if (entry.predicate(propValue)) {
        return entry.renderer;
      }
    }

    return null;
  }

  /**
   * Clear all registered renderers and cache (useful for testing)
   */
  clear(): void {
    this.predicateRenderers = [];
    this.typeCache.clear();
  }
}

export default PropertyTypeRegistry;

