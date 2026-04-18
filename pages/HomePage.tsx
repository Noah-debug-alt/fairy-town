import React, { useState } from 'react';
import { Form, Input, Upload, Button, message, Card, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import mammoth from 'mammoth';
import type { UploadFile } from 'antd/es/upload/interface';
import type { FormProps } from 'antd';

const { Title, Text } = Typography;

const HomePage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState('');

  // 解析文件内容
  const parseFile = async (file: File): Promise<string> => {
    const { name } = file;
    const extension = name.split('.').pop()?.toLowerCase();

    if (extension === 'txt') {
      return await file.text();
    } else if (extension === 'md') {
      const content = await file.text();
      // 简单处理markdown，保留文本内容
      return content.replace(/[#*`[\]()]/g, '');
    } else if (extension === 'docx') {
      const result = await mammoth.extractRawText({ buffer: await file.arrayBuffer() });
      return result.value;
    } else {
      throw new Error('不支持的文件格式');
    }
  };

  // 处理文件上传
  const handleFileUpload = async (file: UploadFile | File) => {
    try {
      const actualFile = 'originFileObj' in file && file.originFileObj ? file.originFileObj : file as File;
      const content = await parseFile(actualFile);
      setFileContent(content);
      form.setFieldsValue({ content });
      message.success('文件解析成功');
    } catch (error) {
      message.error('文件解析失败：' + (error as Error).message);
    }
    return false; // 阻止自动上传
  };

  // 处理表单提交
  const handleSubmit: FormProps['onFinish'] = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/novel/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (result.code === 200) {
        message.success('上传成功！');
        // 跳转到小说管理页
        window.location.href = '/novel-management';
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('上传失败，请稍后重试');
      console.error('上传失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
      <Title level={1}>童话镇 - 多智能体角色扮演系统</Title>
      <Text>欢迎来到童话镇，一个充满魔法和冒险的世界！</Text>
      
      <Card style={{ marginTop: '20px' }}>
        <Title level={3}>小说上传</Title>
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="小说标题"
            rules={[{ required: true, message: '请输入小说标题' }]}
          >
            <Input placeholder="请输入小说标题" />
          </Form.Item>

          <Form.Item
            name="author"
            label="作者"
          >
            <Input placeholder="请输入作者（可选）" />
          </Form.Item>

          <Form.Item
            name="content"
            label="小说内容"
            rules={[
              { required: true, message: '请输入小说内容' },
              { max: 1000000, message: '内容过长，不能超过100万字' }
            ]}
          >
            <Input.TextArea
              rows={10}
              placeholder="请粘贴小说/剧本全文"
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
            />
          </Form.Item>

          <Form.Item
            name="remark"
            label="备注"
          >
            <Input.TextArea rows={3} placeholder="请输入备注（可选）" />
          </Form.Item>

          <Form.Item>
            <Upload
              name="file"
              accept=".txt,.md,.docx"
              showUploadList={false}
              beforeUpload={handleFileUpload}
            >
              <Button icon={<UploadOutlined />}>上传文件</Button>
            </Upload>
            <Text type="secondary" style={{ marginLeft: '10px' }}>
              支持txt、md、docx格式文件
            </Text>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              上传小说
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default HomePage;
