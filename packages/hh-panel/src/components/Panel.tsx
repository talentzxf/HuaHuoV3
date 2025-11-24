import React from 'react';

export interface PanelProps {
  title?: string;
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
}

export const Panel: React.FC<PanelProps> = ({
  title = 'Panel',
  children,
  width = '100%',
  height = 'auto',
}) => {
  return (
    <div
      style={{
        width,
        height,
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        padding: '16px',
        backgroundColor: '#fff',
      }}
    >
      {title && (
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
          {title}
        </h3>
      )}
      <div>{children}</div>
    </div>
  );
};

export default Panel;

