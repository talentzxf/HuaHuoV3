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
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <Title level={2}>Redux Counter Example</Title>
      <Title level={1} style={{ color: '#1890ff', margin: '30px 0' }}>
        {count}
      </Title>
      <Space size="large">
        <Button
          type="primary"
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
    </div>
  );
};

export default Counter;

