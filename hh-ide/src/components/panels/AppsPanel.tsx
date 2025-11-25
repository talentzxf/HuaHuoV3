import React from 'react';
import { Card, Typography, List } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';

const { Title } = Typography;

const AppsPanel: React.FC = () => {
  const apps = [
    { name: 'App 1', description: 'First application' },
    { name: 'App 2', description: 'Second application' },
    { name: 'App 3', description: 'Third application' },
    { name: 'App 4', description: 'Fourth application' },
  ];

  return (
    <div style={{ padding: '20px', height: '100%', overflow: 'auto', background: '#fff' }}>
      <Card bordered={false}>
        <Title level={2}>
          <AppstoreOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
          Applications
        </Title>
        <List
          dataSource={apps}
          renderItem={(app) => (
            <List.Item>
              <List.Item.Meta
                avatar={<AppstoreOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
                title={<strong>{app.name}</strong>}
                description={app.description}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default AppsPanel;

