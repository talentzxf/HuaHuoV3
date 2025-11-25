import React from 'react';
import { Card, Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const HomePanel: React.FC = () => {
  return (
    <div style={{ padding: '20px', height: '100%', overflow: 'auto', background: '#fff' }}>
      <Card bordered={false}>
        <Title level={2}>
          <HomeOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
          Welcome to HH IDE
        </Title>
        <Paragraph style={{ fontSize: '16px' }}>
          This is a dockable and resizable layout powered by Golden Layout.
        </Paragraph>
        <Paragraph style={{ fontSize: '14px', color: '#666' }}>
          You can drag and drop tabs to rearrange them, resize panels, and create
          your own custom workspace layout.
        </Paragraph>
        <Title level={4} style={{ marginTop: '24px' }}>
          <strong>✨ Features:</strong>
        </Title>
        <ul style={{ fontSize: '14px', lineHeight: '2' }}>
          <li><strong>Dockable panels</strong> - drag tabs to dock them anywhere</li>
          <li><strong>Resizable panels</strong> - drag borders to resize</li>
          <li><strong>Multiple tab stacks</strong> - organize your workspace</li>
          <li><strong>Tab switching</strong> - click tabs to switch between panels</li>
        </ul>
      </Card>
    </div>
  );
};

export default HomePanel;

