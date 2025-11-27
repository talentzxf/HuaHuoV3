import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Space } from 'antd';
import {
  BorderOutlined,
  DragOutlined,
} from '@ant-design/icons';
import paper from 'paper';
import { SDK } from '@/sdk';
import './CanvasPanel.css';

type DrawTool = 'pointer' | 'circle' | 'rectangle' | 'line' | null;

const CanvasPanel: React.FC = () => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<DrawTool>('pointer');
  const currentToolRef = useRef<DrawTool>('pointer');

  // Toolbar dragging state
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Paper.js references
  const paperScopeRef = useRef<paper.PaperScope | null>(null);

  // Update current tool ref when tool changes
  useEffect(() => {
    currentToolRef.current = currentTool;
    // Update tool registry when tool changes
    if (currentTool) {
      SDK.Editor.Tools.setCurrentTool(currentTool);
    }
  }, [currentTool]);

  // Initialize Paper.js
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Setup Paper.js - it will automatically read canvas dimensions
    const scope = new paper.PaperScope();
    scope.setup(canvas);
    paperScopeRef.current = scope;

    // Initialize Scene SDK
    SDK.Scene.initialize(scope);

    // Create default scene and layers
    const scene = SDK.Scene.createScene('DefaultScene');
    scene.addLayer('background');
    scene.addLayer('drawing');

    console.log('Scene initialized:', scene);

    // Get internal registry for event handling
    const registry = SDK.Editor.Tools.getRegistry();

    // Set default tool
    SDK.Editor.Tools.setCurrentTool('pointer');

    // Tool for drawing and selection
    const tool = new scope.Tool();

    tool.onMouseDown = (event: paper.ToolEvent) => {
      registry.handleMouseDown(event, scope);
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      registry.handleMouseDrag(event, scope);
    };

    tool.onMouseUp = (event: paper.ToolEvent) => {
      registry.handleMouseUp(event, scope);
    };

    // Handle delete key for selected items and ESC key to switch to pointer
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (scope.project) {
          scope.project.activeLayer.children.forEach((item: any) => {
            if (item.selected) {
              item.remove();
            }
          });
        }
      } else if (e.key === 'Escape') {
        // Switch to pointer tool
        setCurrentTool('pointer');
        SDK.Editor.Tools.setCurrentTool('pointer');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Define canvas aspect ratio (4:3)
    const CANVAS_ASPECT_RATIO = 4 / 3;
    const BASE_WIDTH = 800;
    const BASE_HEIGHT = BASE_WIDTH / CANVAS_ASPECT_RATIO; // 600

    // Get Paper.js layers from Scene system
    const sceneBackgroundLayer = scene.getLayer('background');
    const sceneDrawingLayer = scene.getLayer('drawing');

    if (!sceneBackgroundLayer || !sceneDrawingLayer) {
      console.error('Failed to get scene layers');
      return;
    }

    // Get the actual Paper.js Layer objects
    const backgroundLayer = (sceneBackgroundLayer as any).getPaperLayer() as paper.Layer;
    const drawingLayer = (sceneDrawingLayer as any).getPaperLayer() as paper.Layer;

    // Lock background layer to prevent selection
    backgroundLayer.locked = true;

    // Activate drawing layer for user drawings
    drawingLayer.activate();

    // Create white canvas rectangle (fixed 4:3 aspect ratio)
    const whiteCanvas = new scope.Path.Rectangle({
      point: [0, 0],
      size: [BASE_WIDTH, BASE_HEIGHT],
      fillColor: new scope.Color('white'),
      strokeColor: new scope.Color('#cccccc'),
      strokeWidth: 2,
    });
    whiteCanvas.name = 'whiteCanvas';
    whiteCanvas.locked = true; // Lock white canvas to prevent selection
    backgroundLayer.addChild(whiteCanvas);

    // Store reference to white canvas for later access
    let whiteCanvasRect = whiteCanvas;

    // Store previous scale to calculate delta
    let previousScale = 1;
    let previousOffset = new scope.Point(0, 0);

    // Resize handler - maintain 4:3 aspect ratio and fit to window
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container || !scope.view) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Skip resize if container is hidden (width/height = 0)
      // This happens when FlexLayout hides the tab
      if (containerWidth === 0 || containerHeight === 0) {
        console.log('Container hidden, skipping resize');
        return;
      }

      // Update Paper.js view size
      scope.view.viewSize = new scope.Size(containerWidth, containerHeight);

      // Calculate scale to fit canvas with 4:3 ratio in container
      const scaleX = containerWidth / BASE_WIDTH;
      const scaleY = containerHeight / BASE_HEIGHT;
      const scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for some padding

      // Position and scale white canvas to center
      const scaledWidth = BASE_WIDTH * scale;
      const scaledHeight = BASE_HEIGHT * scale;
      const x = (containerWidth - scaledWidth) / 2;
      const y = (containerHeight - scaledHeight) / 2;
      const newOffset = new scope.Point(x, y);

      // Reset background layer transformations
      backgroundLayer.transform(new scope.Matrix());

      // Update white canvas position and size
      whiteCanvasRect.bounds = new scope.Rectangle(x, y, scaledWidth, scaledHeight);

      // Calculate delta scale and delta offset
      const deltaScale = scale / previousScale;
      const deltaOffset = newOffset.subtract(previousOffset);

      // Apply incremental transformation to drawing layer
      // First, translate to compensate for offset change
      drawingLayer.translate(deltaOffset);

      // Then scale from the new origin point
      if (deltaScale !== 1) {
        drawingLayer.scale(deltaScale, newOffset);
      }

      // Update previous values
      previousScale = scale;
      previousOffset = newOffset;
    };

    // Initial size setup
    resizeCanvas();

    // Use ResizeObserver for better resize detection
    const resizeObserver = new ResizeObserver(() => {
        console.log('resize observer');
      resizeCanvas();
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      // Clean up paper.js project
      if (scope.project) {
          console.log("Clearing Paper.js project");
        scope.project.clear();
      }
    };
  }, []);

  // Toolbar drag handlers
  const handleToolbarDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!toolbarRef.current) return;

    const rect = toolbarRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDraggingToolbar(true);
  };

  const handleToolbarDragMove = (e: MouseEvent) => {
    if (!isDraggingToolbar || !toolbarRef.current) return;

    const container = toolbarRef.current.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const toolbarRect = toolbarRef.current.getBoundingClientRect();

    let newX = e.clientX - containerRect.left - dragOffset.x;
    let newY = e.clientY - containerRect.top - dragOffset.y;

    // Constrain within container bounds
    newX = Math.max(0, Math.min(newX, containerRect.width - toolbarRect.width));
    newY = Math.max(0, Math.min(newY, containerRect.height - toolbarRect.height));

    // Magnetic snap to edges (snap zone: 30px)
    const snapZone = 30;

    // Snap to left edge
    if (newX < snapZone) {
      newX = 8;
    }
    // Snap to right edge
    else if (newX > containerRect.width - toolbarRect.width - snapZone) {
      newX = containerRect.width - toolbarRect.width - 8;
    }

    // Snap to top edge
    if (newY < snapZone) {
      newY = 8;
    }
    // Snap to bottom edge
    else if (newY > containerRect.height - toolbarRect.height - snapZone) {
      newY = containerRect.height - toolbarRect.height - 8;
    }

    setToolbarPosition({ x: newX, y: newY });
  };

  const handleToolbarDragEnd = () => {
    setIsDraggingToolbar(false);
  };

  // Add/remove toolbar drag listeners
  useEffect(() => {
    if (isDraggingToolbar) {
      window.addEventListener('mousemove', handleToolbarDragMove);
      window.addEventListener('mouseup', handleToolbarDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleToolbarDragMove);
        window.removeEventListener('mouseup', handleToolbarDragEnd);
      };
    }
  }, [isDraggingToolbar, dragOffset]);

  // Initialize toolbar position (centered)
  useEffect(() => {
    if (!toolbarRef.current || toolbarPosition !== null) return;

    const container = toolbarRef.current.parentElement;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const toolbarRect = toolbarRef.current.getBoundingClientRect();

      setToolbarPosition({
        x: (containerRect.width - toolbarRect.width) / 2,
        y: 16,
      });
    }
  }, [toolbarPosition]);

  return (
    <div className="canvas-panel">
      {/* Floating toolbar */}
      <div
        ref={toolbarRef}
        className={`canvas-toolbar ${isDraggingToolbar ? 'dragging' : ''}`}
        style={toolbarPosition ? {
          left: `${toolbarPosition.x}px`,
          top: `${toolbarPosition.y}px`,
          transform: 'none',
        } : undefined}
      >
        {/* Drag handle */}
        <div
          className="canvas-toolbar-handle"
          onMouseDown={handleToolbarDragStart}
        >
          <div className="canvas-toolbar-handle-bar" />
          <div className="canvas-toolbar-handle-bar" />
        </div>

        <Space size="small">
          <Button
            type={currentTool === 'pointer' ? 'primary' : 'default'}
            icon={<DragOutlined />}
            onClick={() => setCurrentTool('pointer')}
            title={t('canvas.tools.pointer')}
            className="canvas-tool-button"
          />
          <Button
            type={currentTool === 'circle' ? 'primary' : 'default'}
            onClick={() => setCurrentTool('circle')}
            title={t('canvas.tools.circle')}
            className="canvas-tool-button"
          >
            <span style={{ fontSize: '16px', fontWeight: 'normal' }}>○</span>
          </Button>
          <Button
            type={currentTool === 'rectangle' ? 'primary' : 'default'}
            icon={<BorderOutlined />}
            onClick={() => setCurrentTool('rectangle')}
            title={t('canvas.tools.rectangle')}
            className="canvas-tool-button"
          />
          <Button
            type={currentTool === 'line' ? 'primary' : 'default'}
            onClick={() => setCurrentTool('line')}
            title={t('canvas.tools.line')}
            className="canvas-tool-button"
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>／</span>
          </Button>
        </Space>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="canvas-drawing-area"
        style={{ cursor: currentTool === 'pointer' ? 'default' : 'crosshair' }}
      />

      {/* Hint message */}
      {!currentTool && (
        <div className="canvas-hint">
          {t('canvas.hint')}
        </div>
      )}

      {/* Status bar */}
      {currentTool && (
        <div className="canvas-status">
          {t('canvas.status.currentTool')}: {t(`canvas.toolNames.${currentTool}`)}
        </div>
      )}
    </div>
  );
};

export default CanvasPanel;

