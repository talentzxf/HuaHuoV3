import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Space } from 'antd';
import {
  BorderOutlined,
  DragOutlined,
} from '@ant-design/icons';
import paper from 'paper';
import { SDK } from '@huahuo/sdk';
import { getKernel } from '@huahuo/engine';
import { Timeline } from '@huahuo/timeline';
import { store } from '../../store/store';
import type { RootState } from '../../store/store';
import { getSelectionAdapter } from '../../adapters/SelectionAdapter';
import { requestCanvasRefresh, clearCanvasRefreshFlag } from '../../store/features/canvas/canvasSlice';
import { TimelineContextMenu } from './TimelineContextMenu';
import { PointerTool, CircleTool, RectangleTool, LineTool } from './tools';
import { ObjectDeleteHandler } from './tools/handlers';
import './CanvasPanel.css';

type DrawTool = 'pointer' | 'circle' | 'rectangle' | 'line' | null;

const CanvasPanel: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
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

  // Get project totalFrames and fps from Kernel
  const [totalFrames, setTotalFrames] = useState(120);
  const [fps, setFps] = useState(30);
  const [animationEndFrame, setAnimationEndFrame] = useState<number | null>(null);

  // Get canvas refresh flag from Redux store
  const needsRefresh = useSelector((state: RootState) => state.canvas.needsRefresh);

  // Timeline state
  const [currentFrame, setCurrentFrame] = useState(0);
  const [tracks, setTracks] = useState<Array<{
    id: string;
    name: string;
    clips?: Array<{ id: string; startFrame: number; length: number }>;
    keyFrames?: number[];
  }>>([]);
  const [timelineHeight, setTimelineHeight] = useState(100); // Dynamic height

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    frameNumber: number;
    trackId?: string;
    clip?: { id: string; startFrame: number; length: number };
  } | null>(null);

  // Load Scene data — driven by Kernel events instead of Redux store diff
  useEffect(() => {
    const subIds: number[] = [];

    const updateProjectMeta = () => {
      const kernel = getKernel();
      if (!kernel.ready) return;
      const project = kernel.getProject();
      if (project) {
        setTotalFrames(project.total_frames ?? 120);
        setFps(project.fps ?? 30);
        setAnimationEndFrame(project.animation_end_frame ?? null);
      }
    };

    const updateTimelineData = () => {
      if (!SDK.isInitialized()) return;
      const kernel = getKernel();
      if (!kernel.ready) return;

      const scene = SDK.instance.Scene.getCurrentScene();
      if (!scene) return;

      // Current frame from kernel playback state
      const pb = kernel.getPlaybackState();
      if (pb) setCurrentFrame(pb.current_frame ?? 0);

      // Build tracks from kernel scene data (layers + keyframes)
      const kernelScene = kernel.getCurrentScene();
      const trackList = scene.layers
        .filter((layer: any) => layer.hasTimeline)
        .map((layer: any) => {
          const kLayer = kernelScene?.layers?.[layer.id];
          return {
            id: layer.id,
            name: layer.name,
            clips: kLayer?.clips ?? [],
            keyFrames: (kLayer?.key_frames ?? []).map((kf: any) => kf.frame ?? kf),
          };
        });
      setTracks(trackList);

      const HEADER_HEIGHT = 30;
      const TRACK_HEIGHT = 30;
      const SCROLLBAR_HEIGHT = 20;
      setTimelineHeight(Math.max(50, HEADER_HEIGHT + trackList.length * TRACK_HEIGHT + SCROLLBAR_HEIGHT));
    };

    SDK.executeAfterInit(() => {
      updateProjectMeta();
      updateTimelineData();

      const kernel = getKernel();
      if (!kernel.ready) return;

      // Cheap: only move the playhead cursor — no scene rebuild needed.
      const updateFrameOnly = () => {
        const pb = kernel.getPlaybackState();
        if (pb) setCurrentFrame(pb.current_frame ?? 0);
      };

      subIds.push(kernel.subscribe('playback/frame_changed', updateFrameOnly));
      subIds.push(kernel.subscribe('playback/looped_back',   updateFrameOnly));
      subIds.push(kernel.subscribe('playback/stopped',       updateFrameOnly));
      // Only rebuild track keyframe dots when a new frame is actually added.
      subIds.push(kernel.subscribe('keyframe', (ev) => {
        if (ev.is_new_frame) updateTimelineData();
      }));
      // Structure changes always need a full rebuild.
      subIds.push(kernel.subscribe('go',      () => updateTimelineData()));
      subIds.push(kernel.subscribe('layer',   () => updateTimelineData()));
      subIds.push(kernel.subscribe('project', () => updateProjectMeta()));
    });

    return () => {
      const kernel = getKernel();
      subIds.forEach(id => kernel.unsubscribe(id));
    };
  }, []);

  // Handle dirty flag to refresh canvas (e.g. after clip merge)
  useEffect(() => {
    if (!needsRefresh) return;
    // KernelAdapter already redraws on every kernel event;
    // just clear the flag so CanvasPanel's own refreshes don't double-fire.
    dispatch(clearCanvasRefreshFlag());
  }, [needsRefresh, dispatch]);

  // Timeline event handlers
  const handleCellClick = (trackId: string, frameNumber: number) => {
    getKernel().setCurrentFrame(frameNumber);
  };

  const handleCurrentFrameChange = (frame: number) => {
    getKernel().setCurrentFrame(frame);
  };

  const handleMergeCells = (trackId: string, startFrame: number, endFrame: number) => {
    const kernel = getKernel();
    if (!kernel.ready) {
      console.warn('[CanvasPanel] Kernel not ready — cannot merge');
      dispatch(requestCanvasRefresh());
      return;
    }

    // MergeFrameSpan is a pure layer-level operation — no GameObject needed.
    // It creates a FrameSpan (clip) covering [startFrame, endFrame] and merges
    // any existing clips that overlap with that range.
    try {
      const cmd = { MergeFrameSpan: { layer_id: trackId, start_frame: startFrame, end_frame: endFrame } };
      const res = kernel.dispatch(cmd);
      if (!res.ok) {
        console.warn('[CanvasPanel] MergeFrameSpan failed', res);
      }
    } catch (e) {
      console.warn('[CanvasPanel] MergeFrameSpan exception', e);
    }

    dispatch(requestCanvasRefresh());
  };

  const handleSplitClip = (trackId: string, clipId: string, splitFrame: number) => {
    // TODO: add SplitTimelineClip command to kernel
    console.warn('[CanvasPanel] SplitTimelineClip not yet in kernel — layerId:', trackId, 'clipId:', clipId, 'frame:', splitFrame);
    dispatch(requestCanvasRefresh());
  };

  const handleCellRightClick = (
    trackId: string,
    frameNumber: number,
    x: number,
    y: number,
    clip?: { id: string; startFrame: number; length: number }
  ) => {
    console.log('Cell right-clicked:', { trackId, frameNumber, x, y, clip });

    // Show context menu with clip info
    setContextMenu({
      visible: true,
      x,
      y,
      frameNumber,
      trackId,
      clip
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Update current tool ref when tool changes
  useEffect(() => {
    currentToolRef.current = currentTool;
    // Update tool registry when tool changes
    if (currentTool && SDK.isInitialized()) {
      SDK.instance.Editor.setCurrentTool(currentTool);
    }
  }, [currentTool]);

  // Initialize Paper.js
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize SDK with canvas element (no Redux store needed — data layer is now Rust/WASM)
    SDK.initialize(canvas);

    // Get the Paper.js scope from SDK (same scope as engine uses)
    const scope = SDK.instance.getPaperScope();
    if (!scope) {
      console.error('Failed to get Paper.js scope from SDK');
      return;
    }
    paperScopeRef.current = scope;

    console.log('[CanvasPanel] Using SDK Paper.js scope:', !!scope);
    console.log('[CanvasPanel] Paper.js project layers:', scope.project.layers.length);

    // Start SelectionAdapter to sync IDE selection to Engine
    getSelectionAdapter().startListening();

    // Register tools
    SDK.instance.Editor.registerTool(new PointerTool('#1890ff'));
    SDK.instance.Editor.registerTool(new CircleTool('#1890ff'));
    SDK.instance.Editor.registerTool(new RectangleTool('#1890ff'));
    SDK.instance.Editor.registerTool(new LineTool('#1890ff'));


    // Set default tool
    SDK.instance.Editor.setCurrentTool('pointer');

    // Get internal registry for event handling
    const registry = SDK.instance.Editor.getToolRegistry();

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
        // Use ObjectDeleteHandler to delete selected object
        const deleted = ObjectDeleteHandler.deleteSelected();

        if (deleted) {
          console.log('[CanvasPanel] Object deleted successfully');
        }
      } else if (e.key === 'Escape') {
        // Switch to pointer tool
        setCurrentTool('pointer');
        SDK.instance.Editor.setCurrentTool('pointer');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Define canvas base dimensions (4:3 aspect ratio)
    const BASE_WIDTH = 800;
    const BASE_HEIGHT = 600;

    // Resize handler - uses SDK to handle all layers uniformly
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) {
        console.log('[CanvasPanel.resizeCanvas] No container');
        return;
      }

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      console.log('[CanvasPanel.resizeCanvas] Called with container size:', containerWidth, 'x', containerHeight);

      // Use SDK's unified resize method
      SDK.instance.handleCanvasResize(containerWidth, containerHeight, BASE_WIDTH, BASE_HEIGHT);
    };

    // Initial size setup
    console.log('[CanvasPanel] Performing initial resize');
    resizeCanvas();

    // Use ResizeObserver for better resize detection
    const resizeObserver = new ResizeObserver(() => {
      console.log('[CanvasPanel] ResizeObserver triggered');
      resizeCanvas();
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      // Note: Don't clear Paper.js project here since it's owned by SDK
      // The SDK will manage the Paper.js scope lifecycle
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
    <div className="canvas-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Timeline area - only show if there are tracks with timeline */}
      {tracks.length > 0 && (
        <div style={{
          height: `${timelineHeight}px`,
          minHeight: '50px',
          borderBottom: '1px solid #444',
          overflow: 'hidden'
        }}>
              <Timeline
                frameCount={totalFrames}
                fps={fps}
                currentFrame={currentFrame}
                animationEndFrame={animationEndFrame}
                tracks={tracks}
                onCellClick={handleCellClick}
                onCurrentFrameChange={handleCurrentFrameChange}
                onMergeCells={handleMergeCells}
                onSplitClip={handleSplitClip}
                onCellRightClick={handleCellRightClick}
              />
        </div>
      )}

      {/* Context menu for Timeline */}
      <TimelineContextMenu
        visible={contextMenu?.visible ?? false}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        frameNumber={contextMenu?.frameNumber ?? 0}
        trackId={contextMenu?.trackId}
        clip={contextMenu?.clip}
        onClose={handleCloseContextMenu}
      />

      {/* Canvas area - takes remaining space */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
    </div>
  );
};

export default CanvasPanel;

