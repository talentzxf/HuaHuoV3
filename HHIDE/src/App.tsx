import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import {
  HomeOutlined,
  AppstoreOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import Counter from './components/Counter';

const { Header, Content, Footer, Sider } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const menuItems = [
    {
      key: '1',
      icon: <HomeOutlined />,
      label: 'Home',
    },
    {
      key: '2',
      icon: <AppstoreOutlined />,
      label: 'Apps',
    },
    {
      key: '3',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{
          background: '#001529',
        }}
      >
        <div style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '20px',
          fontWeight: 'bold'
        }}>
          HH IDE
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['1']}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Title level={3} style={{ margin: 0 }}>
            React + Redux + Ant Design Scaffold
          </Title>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div style={{
            padding: 24,
            minHeight: 360,
            background: '#fff',
            borderRadius: '8px'
          }}>
            <Counter />
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          HH IDE ©{new Date().getFullYear()} Created with React + Redux + Ant Design
        </Footer>
      </Layout>
    </Layout>
  );
};

export default App;

