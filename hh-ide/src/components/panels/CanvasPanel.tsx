import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Space } from 'antd';
import {
  BorderOutlined,
} from '@ant-design/icons';
import './CanvasPanel.css';

type DrawTool = 'circle' | 'rectangle' | 'line' | null;

interface Point {
  x: number;
  y: number;
}

interface Shape {
  type: 'circle' | 'rectangle' | 'line';
  start: Point;
  end: Point;
  color: string;
}

const CanvasPanel: React.FC = () => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<DrawTool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentColor, setCurrentColor] = useState('#1890ff');

  // Toolbar dragging state
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Redraw all shapes
  const redrawCanvas = (ctx: CanvasRenderingContext2D, tempShape?: Shape) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all saved shapes
    shapes.forEach(shape => {
      drawShape(ctx, shape);
    });

    // Draw temporary shape (currently being drawn)
    if (tempShape) {
      drawShape(ctx, tempShape);
    }
  };

  // Draw a single shape
  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = 2;

    switch (shape.type) {
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(shape.end.x - shape.start.x, 2) +
          Math.pow(shape.end.y - shape.start.y, 2)
        );
        ctx.beginPath();
        ctx.arc(shape.start.x, shape.start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case 'rectangle':
        const width = shape.end.x - shape.start.x;
        const height = shape.end.y - shape.start.y;
        ctx.strokeRect(shape.start.x, shape.start.y, width, height);
        break;

      case 'line':
        ctx.beginPath();
        ctx.moveTo(shape.start.x, shape.start.y);
        ctx.lineTo(shape.end.x, shape.end.y);
        ctx.stroke();
        break;
    }
  };

  // Mouse down event
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentTool || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPoint({ x, y });
  };

  // Mouse move event
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !currentTool || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Create temporary shape for preview
    const tempShape: Shape = {
      type: currentTool,
      start: startPoint,
      end: { x, y },
      color: currentColor,
    };

    redrawCanvas(ctx, tempShape);
  };

  // Mouse up event
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !currentTool || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Save the shape
    const newShape: Shape = {
      type: currentTool,
      start: startPoint,
      end: { x, y },
      color: currentColor,
    };

    setShapes([...shapes, newShape]);
    setIsDrawing(false);
    setStartPoint(null);

    console.log('Shape drawn:', newShape);
  };

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

  // Initialize canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          redrawCanvas(ctx);
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Redraw canvas when shapes list changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      redrawCanvas(ctx);
    }
  }, [shapes]);

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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setStartPoint(null);
          }
        }}
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

