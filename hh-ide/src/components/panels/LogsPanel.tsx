import React, { useEffect, useState, useRef } from 'react';
import { Card, Button, Space, Tag } from 'antd';
import { ClearOutlined, DownloadOutlined } from '@ant-design/icons';
import './LogsPanel.css';

interface LogEntry {
  id: number;
  type: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  args?: any[];
}

const LogsPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  useEffect(() => {
    // Store original console methods
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    // Create logger function
    const createLogger = (type: LogEntry['type'], originalMethod: Function) => {
      return (...args: any[]) => {
        // Call original method
        originalMethod.apply(console, args);

        // Record log
        const message = args
          .map((arg) => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg, null, 2);
              } catch (e) {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(' ');

        setLogs((prevLogs) => [
          ...prevLogs,
          {
            id: logIdRef.current++,
            type,
            message,
            timestamp: new Date(),
            args,
          },
        ]);
      };
    };

    // Override console methods
    console.log = createLogger('log', originalConsole.log);
    console.info = createLogger('info', originalConsole.info);
    console.warn = createLogger('warn', originalConsole.warn);
    console.error = createLogger('error', originalConsole.error);

    // Cleanup: restore original console methods
    return () => {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleClear = () => {
    setLogs([]);
  };

  const handleExport = () => {
    const logsText = logs
      .map(
        (log) =>
          `[${log.timestamp.toLocaleTimeString()}] [${log.type.toUpperCase()}] ${log.message}`
      )
      .join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'red';
      case 'warn':
        return 'orange';
      case 'info':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getLogTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📝';
    }
  };

  return (
    <div className="logs-panel">
      <Card
        size="small"
        title={
          <Space>
            <span>Console Logs</span>
            <Tag color="blue">{logs.length}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={logs.length === 0}
            >
              Export
            </Button>
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={handleClear}
              disabled={logs.length === 0}
            >
              Clear
            </Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
        className="logs-panel-card"
      >
        <div className="logs-content">
          {logs.length === 0 ? (
            <div className="logs-empty">No logs yet. Console output will appear here.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`log-entry log-entry-${log.type}`}>
                <span className="log-time">{log.timestamp.toLocaleTimeString()}</span>
                <span className="log-icon">{getLogTypeIcon(log.type)}</span>
                <Tag color={getLogTypeColor(log.type)} className="log-type">
                  {log.type.toUpperCase()}
                </Tag>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </Card>
    </div>
  );
};

export default LogsPanel;

