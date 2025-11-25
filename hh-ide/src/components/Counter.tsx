import React from 'react';
import { Button, Space, Typography } from 'antd';
import { PlusOutlined, MinusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { increment, decrement, reset } from '@/store/features/counter/counterSlice';

const { Title } = Typography;

const Counter: React.FC = () => {
  const count = useAppSelector((state) => state.counter.value);
  const dispatch = useAppDispatch();

  return (
    <div style={{
      textAlign: 'center',
      padding: '50px',
      height: '100%',
      background: '#fff',
      overflow: 'auto',
    }}>
      <Title level={2}>
        🔢 Redux Counter Example
      </Title>
      <div style={{
        fontSize: '72px',
        fontWeight: 'bold',
        color: '#1890ff',
        margin: '40px 0',
        textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
      }}>
        {count}
      </div>
      <Space size="large">
        <Button
          type="primary"
          danger
          icon={<MinusOutlined />}
          onClick={() => dispatch(decrement())}
          size="large"
        >
          Decrement
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => dispatch(reset())}
          size="large"
        >
          Reset
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => dispatch(increment())}
          size="large"
        >
          Increment
        </Button>
      </Space>
      <div style={{ marginTop: '30px', color: '#666', fontSize: '14px' }}>
        <p>This counter uses Redux for state management.</p>
        <p>The state persists across all panels!</p>
      </div>
    </div>
  );
};

export default Counter;

