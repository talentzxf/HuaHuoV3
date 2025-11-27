import React from 'react';
import { Card, Typography, Form, Switch, Select } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { Option } = Select;

const SettingsPanel: React.FC = () => {
  return (
    <div style={{ padding: '20px', height: '100%', overflow: 'auto', background: '#fff' }}>
      <Card variant="borderless">
        <Title level={2}>
          <SettingOutlined style={{ color: '#faad14', marginRight: '8px' }} />
          Settings
        </Title>
        <Form
          layout="vertical"
          initialValues={{
            theme: 'dark',
            notifications: true,
            autosave: true,
          }}
        >
          <Form.Item label="Theme" name="theme">
            <Select>
              <Option value="light">Light</Option>
              <Option value="dark">Dark</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Enable Notifications" name="notifications" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Auto Save" name="autosave" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SettingsPanel;

