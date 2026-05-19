import React, { useState } from 'react';
import { Form, Input, Upload, Button, message, Typography, Row, Col, Divider } from 'antd';
import { UploadOutlined, BookOutlined, CloudUploadOutlined, FileTextOutlined, ReadOutlined, StarOutlined } from '@ant-design/icons';
import mammoth from 'mammoth';
import type { UploadFile } from 'antd/es/upload/interface';
import type { FormProps } from 'antd';

const { Title, Text, Paragraph } = Typography;

const HomePage: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fileContent, setFileContent] = useState('');
    const [fileName, setFileName] = useState('');

    const parseFile = async (file: File): Promise<string> => {
        const { name } = file;
        const extension = name.split('.').pop()?.toLowerCase();

        if (extension === 'txt') {
            return await file.text();
        } else if (extension === 'md') {
            const content = await file.text();
            return content.replace(/[#*`[\]()]/g, '');
        } else if (extension === 'docx') {
            const result = await mammoth.extractRawText({ buffer: await file.arrayBuffer() });
            return result.value;
        } else {
            throw new Error('不支持的文件格式');
        }
    };

    const handleFileUpload = async (file: UploadFile | File) => {
        try {
            const actualFile = 'originFileObj' in file && file.originFileObj ? file.originFileObj : file as File;
            const content = await parseFile(actualFile);
            setFileContent(content);
            setFileName(actualFile.name);
            form.setFieldsValue({ content });
            message.success('文件解析成功');
        } catch (error) {
            message.error('文件解析失败：' + (error as Error).message);
        }
        return false;
    };

    const handleSubmit: FormProps['onFinish'] = async (values) => {
        setLoading(true);
        try {
            const response = await fetch('/api/novel/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            const result = await response.json();

            if (result.code === 200) {
                message.success('上传成功！正在跳转...');
                setTimeout(() => { window.location.href = '/novel-management'; }, 800);
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
        <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f0f2f5 0%, #e6e9f0 100%)' }}>
            {/* 顶部英雄区域 */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                padding: '60px 24px 80px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'url("data:image/svg+xml,%3Csvg width=\'80\' height=\'80\' viewBox=\'0 0 80 80\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M50 50c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10zM10 10c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10S0 25.523 0 20s4.477-10 10-10z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    pointerEvents: 'none'
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 100, height: 100, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)', marginBottom: 24
                    }}>
                        <BookOutlined style={{ fontSize: 48, color: '#fff' }} />
                    </div>
                    <Title level={1} style={{ color: '#fff', margin: '0 0 12px 0', fontSize: 42 }}>
                        童话镇
                    </Title>
                    <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, margin: '0 auto', maxWidth: 500 }}>
                        AI驱动的多智能体角色扮演系统，让你的故事活起来
                    </Paragraph>
                </div>
            </div>

            {/* 功能亮点 */}
            <div style={{ maxWidth: 1100, margin: '-40px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
                <Row gutter={[20, 20]}>
                    {[
                        { icon: <ReadOutlined />, title: '小说解析', desc: 'AI自动提取角色、场景与情节' },
                        { icon: <StarOutlined />, title: '小镇模拟', desc: '角色在小镇中自主生活与互动' },
                        { icon: <CloudUploadOutlined />, title: '情节编织', desc: '预测未来发展，干预故事走向' },
                    ].map((item, idx) => (
                        <Col xs={24} sm={8} key={idx}>
                            <div style={{
                                background: '#fff', borderRadius: 16, padding: '28px 24px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center',
                                transition: 'transform 0.3s ease',
                                cursor: 'default'
                            }}>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 56, height: 56, borderRadius: 16,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    marginBottom: 16
                                }}>
                                    <span style={{ fontSize: 26, color: '#fff' }}>{item.icon}</span>
                                </div>
                                <Title level={5} style={{ margin: '0 0 8px 0' }}>{item.title}</Title>
                                <Text type="secondary" style={{ fontSize: 13 }}>{item.desc}</Text>
                            </div>
                        </Col>
                    ))}
                </Row>
            </div>

            {/* 上传表单区域 */}
            <div style={{ maxWidth: 800, margin: '40px auto 0', padding: '0 24px 60px' }}>
                <div style={{
                    background: '#fff', borderRadius: 20,
                    boxShadow: '0 8px 40px rgba(0,0,0,0.1)', overflow: 'hidden'
                }}>
                    {/* 表单头部 */}
                    <div style={{
                        background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)',
                        padding: '28px 32px 20px',
                        borderBottom: '1px solid #f0f0f0'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 44, height: 44, borderRadius: 12,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            }}>
                                <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />
                            </div>
                            <div>
                                <Title level={4} style={{ margin: 0 }}>上传小说</Title>
                                <Text type="secondary" style={{ fontSize: 13 }}>上传你的故事，开启童话镇之旅</Text>
                            </div>
                        </div>
                    </div>

                    {/* 表单内容 */}
                    <div style={{ padding: '28px 32px 32px' }}>
                        <Form form={form} onFinish={handleSubmit} layout="vertical" size="large">
                            <Row gutter={20}>
                                <Col xs={24} sm={16}>
                                    <Form.Item
                                        name="title"
                                        label={<Text strong>小说标题</Text>}
                                        rules={[{ required: true, message: '请输入小说标题' }]}
                                    >
                                        <Input
                                            placeholder="给你的故事起个名字"
                                            style={{ borderRadius: 10 }}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Form.Item name="author" label={<Text strong>作者</Text>}>
                                        <Input
                                            placeholder="作者名（可选）"
                                            style={{ borderRadius: 10 }}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            {/* 文件上传区域 */}
                            <Form.Item label={<Text strong>小说内容</Text>} required>
                                <Upload
                                    name="file"
                                    accept=".txt,.md,.docx"
                                    showUploadList={false}
                                    beforeUpload={handleFileUpload}
                                >
                                    <div style={{
                                        border: '2px dashed #d9d9d9',
                                        borderRadius: 16,
                                        padding: fileName ? '16px 24px' : '32px 24px',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        background: fileName ? '#f6ffed' : '#fafafa',
                                        transition: 'all 0.3s ease',
                                        borderColor: fileName ? '#52c41a' : '#d9d9d9'
                                    }}>
                                        {fileName ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                <FileTextOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                                                <Text strong style={{ color: '#52c41a' }}>{fileName}</Text>
                                                <Text type="secondary">（点击更换文件）</Text>
                                            </div>
                                        ) : (
                                            <>
                                                <CloudUploadOutlined style={{ fontSize: 36, color: '#bfbfbf', marginBottom: 8 }} />
                                                <div><Text strong>点击上传文件</Text></div>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    支持 .txt / .md / .docx 格式
                                                </Text>
                                            </>
                                        )}
                                    </div>
                                </Upload>
                            </Form.Item>

                            <Form.Item
                                name="content"
                                rules={[
                                    { required: true, message: '请输入小说内容' },
                                    { max: 1000000, message: '内容过长，不能超过100万字' }
                                ]}
                            >
                                <Input.TextArea
                                    rows={8}
                                    placeholder="或直接粘贴小说/剧本全文..."
                                    value={fileContent}
                                    onChange={(e) => setFileContent(e.target.value)}
                                    style={{ borderRadius: 10, fontSize: 14, lineHeight: 1.8 }}
                                />
                            </Form.Item>

                            <Form.Item name="remark" label={<Text strong>备注</Text>}>
                                <Input.TextArea
                                    rows={2}
                                    placeholder="备注信息（可选）"
                                    style={{ borderRadius: 10 }}
                                />
                            </Form.Item>

                            <Divider style={{ margin: '8px 0 24px' }} />

                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                block
                                size="large"
                                style={{
                                    height: 52,
                                    borderRadius: 14,
                                    fontSize: 16,
                                    fontWeight: 'bold',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    border: 'none',
                                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                                }}
                            >
                                {loading ? '正在上传...' : '开始童话之旅'}
                            </Button>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
