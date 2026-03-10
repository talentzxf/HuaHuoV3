import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Space, Typography } from 'antd';
import { getKernel } from '@huahuo/engine';

const { Text } = Typography;

interface ProjectSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    if (open) {
      const p = getKernel().ready ? getKernel().getProject() : null;
      setProject(p);
      if (p) {
        form.setFieldsValue({
          name: p.name,
          totalFrames: p.total_frames,
          fps: p.fps,
          canvasWidth: p.canvas_width,
          canvasHeight: p.canvas_height,
        });
      }
    }
  }, [open, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      // TODO: dispatch project update commands once kernel supports them
      console.info('[ProjectSettingsModal] Project settings updated (kernel commands not yet implemented):', values);
      onClose();
    });
  };

  const handleCancel = () => { form.resetFields(); onClose(); };

  if (!project) return null;

  const duration = ((( project.total_frames ?? 0) / (project.fps ?? 30)) * 1000).toFixed(0);

  return (
    <Modal title="Project Settings" open={open} onOk={handleOk} onCancel={handleCancel} width={500}>
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item label="Project Name" name="name" rules={[{ required: true }]}>
          <Input placeholder="My Animation Project" />
        </Form.Item>

        <Form.Item
          label={<Space><span>Total Frames</span><Text type="secondary" style={{ fontSize: '12px' }}>(Duration: {duration}ms)</Text></Space>}
          name="totalFrames"
          rules={[{ required: true }, { type: 'number', min: 1 }]}
        >
          <InputNumber min={1} max={10000} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="FPS" name="fps" rules={[{ required: true }, { type: 'number', min: 1, max: 120 }]}
        >
          <InputNumber min={1} max={120} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="Canvas Size">
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="canvasWidth" noStyle rules={[{ required: true }]}>
              <InputNumber min={1} max={10000} addonBefore="W" style={{ width: '50%' }} />
            </Form.Item>
            <Form.Item name="canvasHeight" noStyle rules={[{ required: true }]}>
              <InputNumber min={1} max={10000} addonBefore="H" style={{ width: '50%' }} />
            </Form.Item>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectSettingsModal;

