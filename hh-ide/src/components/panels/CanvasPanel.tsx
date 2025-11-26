import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Space } from 'antd';
import {
  BorderOutlined,
  DragOutlined,
} from '@ant-design/icons';
import paper from 'paper';
import './CanvasPanel.css';

type DrawTool = 'pointer' | 'circle' | 'rectangle' | 'line' | null;

const CanvasPanel: React.FC = () => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<DrawTool>('pointer');
  const currentToolRef = useRef<DrawTool>('pointer');
  const [currentColor] = useState('#1890ff');

  // Toolbar dragging state
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Paper.js references
  const paperScopeRef = useRef<paper.PaperScope | null>(null);
  const currentPathRef = useRef<paper.Path | null>(null);
  const startPointRef = useRef<paper.Point | null>(null);

  // Update current tool ref when tool changes
  useEffect(() => {
    currentToolRef.current = currentTool;
  }, [currentTool]);

  // Initialize Paper.js
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Setup Paper.js
    const scope = new paper.PaperScope();
    scope.setup(canvas);
    paperScopeRef.current = scope;

    // Tool for drawing and selection
    const tool = new scope.Tool();

    tool.onMouseDown = (event: paper.ToolEvent) => {
      const currentToolValue = currentToolRef.current;

      if (currentToolValue === 'pointer') {
        // Selection mode
        const hitResult = scope.project.hitTest(event.point, {
          segments: true,
          stroke: true,
          fill: true,
          tolerance: 5
        });

        // Deselect all
        scope.project.activeLayer.children.forEach((item: any) => {
          item.selected = false;
        });

        if (hitResult && hitResult.item) {
          hitResult.item.selected = true;
          console.log('Selected shape:', hitResult.item);
        }
      } else {
        // Drawing mode
        startPointRef.current = event.point;

        switch (currentToolValue) {
          case 'circle':
            currentPathRef.current = new scope.Path.Circle({
              center: event.point,
              radius: 1,
              strokeColor: new scope.Color(currentColor),
              strokeWidth: 2,
            });
            break;

          case 'rectangle':
            currentPathRef.current = new scope.Path.Rectangle({
              from: event.point,
              to: event.point,
              strokeColor: new scope.Color(currentColor),
              strokeWidth: 2,
            });
            break;

          case 'line':
            currentPathRef.current = new scope.Path.Line({
              from: event.point,
              to: event.point,
              strokeColor: new scope.Color(currentColor),
              strokeWidth: 2,
            });
            break;
        }
      }
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      const currentToolValue = currentToolRef.current;

      if (currentToolValue === 'pointer' || !currentPathRef.current || !startPointRef.current) return;

      const start = startPointRef.current;
      const current = event.point;

      switch (currentToolValue) {
        case 'circle':
          const radius = start.getDistance(current);
          (currentPathRef.current as any).radius = radius;
          break;

        case 'rectangle':
          currentPathRef.current.remove();
          currentPathRef.current = new scope.Path.Rectangle({
            from: start,
            to: current,
            strokeColor: new scope.Color(currentColor),
            strokeWidth: 2,
          });
          break;

        case 'line':
          currentPathRef.current.segments[1].point = current;
          break;
      }
    };

    tool.onMouseUp = (event: paper.ToolEvent) => {
      const currentToolValue = currentToolRef.current;

      if (currentToolValue === 'pointer') return;

      if (currentPathRef.current) {
        console.log('Shape created:', currentPathRef.current);
        currentPathRef.current = null;
      }
      startPointRef.current = null;
    };

    // Handle delete key for selected items
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (scope.project) {
          scope.project.activeLayer.children.forEach((item: any) => {
            if (item.selected) {
              item.remove();
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Resize handler
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container && scope.view) {
        scope.view.viewSize = new scope.Size(container.clientWidth, container.clientHeight);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      // Clean up paper.js project
      if (scope.project) {
        scope.project.clear();
      }
    };
  }, [currentColor]);

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

