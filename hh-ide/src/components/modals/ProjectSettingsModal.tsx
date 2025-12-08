import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Space, Typography } from 'antd';
import { useSelector } from 'react-redux';
import { getEngineStore } from '@huahuo/engine';
import { updateProjectName, updateProjectTotalFrames, updateProjectFps, updateProjectCanvasSize } from '@huahuo/engine';
import type { RootState } from '../../store/store';

const { Text } = Typography;

interface ProjectSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ open, onClose }) => {
  const [form] = Form.useForm();

  const project = useSelector((state: RootState) => state.engine.project.current);

  useEffect(() => {
    if (project && open) {
      form.setFieldsValue({
        name: project.name,
        totalFrames: project.totalFrames,
        fps: project.fps,
        canvasWidth: project.canvasWidth,
        canvasHeight: project.canvasHeight,
      });
    }
  }, [project, open, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      const store = getEngineStore();

      if (values.name !== project?.name) {
        store.dispatch(updateProjectName({ name: values.name }));
      }

      if (values.totalFrames !== project?.totalFrames) {
        store.dispatch(updateProjectTotalFrames({ totalFrames: values.totalFrames }));
      }

      if (values.fps !== project?.fps) {
        store.dispatch(updateProjectFps({ fps: values.fps }));
      }

      if (values.canvasWidth !== project?.canvasWidth || values.canvasHeight !== project?.canvasHeight) {
        store.dispatch(updateProjectCanvasSize({
          width: values.canvasWidth,
          height: values.canvasHeight
        }));
      }

      onClose();
    });
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  if (!project) {
    return null;
  }

  const duration = ((project.totalFrames / project.fps) * 1000).toFixed(0);

  return (
    <Modal
      title="Project Settings"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          label="Project Name"
          name="name"
          rules={[{ required: true, message: 'Please input project name!' }]}
        >
          <Input placeholder="My Animation Project" />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <span>Total Frames</span>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                (Duration: {duration}ms)
              </Text>
            </Space>
          }
          name="totalFrames"
          rules={[
            { required: true, message: 'Please input total frames!' },
            { type: 'number', min: 1, message: 'Must be at least 1 frame' }
          ]}
        >
          <InputNumber
            min={1}
            max={10000}
            style={{ width: '100%' }}
            placeholder="120"
          />
        </Form.Item>

        <Form.Item
          label="FPS (Frames Per Second)"
          name="fps"
          rules={[
            { required: true, message: 'Please input FPS!' },
            { type: 'number', min: 1, max: 120, message: 'FPS must be between 1 and 120' }
          ]}
        >
          <InputNumber
            min={1}
            max={120}
            style={{ width: '100%' }}
            placeholder="30"
          />
        </Form.Item>

        <Form.Item label="Canvas Size">
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="canvasWidth"
              noStyle
              rules={[
                { required: true, message: 'Width required' },
                { type: 'number', min: 1, message: 'Must be at least 1' }
              ]}
            >
              <InputNumber
                min={1}
                max={10000}
                placeholder="Width"
                addonBefore="W"
                style={{ width: '50%' }}
              />
            </Form.Item>
            <Form.Item
              name="canvasHeight"
              noStyle
              rules={[
                { required: true, message: 'Height required' },
                { type: 'number', min: 1, message: 'Must be at least 1' }
              ]}
            >
              <InputNumber
                min={1}
                max={10000}
                placeholder="Height"
                addonBefore="H"
                style={{ width: '50%' }}
              />
            </Form.Item>
          </Space.Compact>
        </Form.Item>

        <Form.Item>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Created: {new Date(project.created).toLocaleString()}
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Modified: {new Date(project.modified).toLocaleString()}
            </Text>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectSettingsModal;

