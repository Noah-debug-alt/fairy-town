import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Row, Col, Select, Empty, Spin, message } from 'antd';
import { EditOutlined, BulbOutlined, BookOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface Novel {
    id: number;
    title: string;
    author: string;
    parseStatus: string;
}

const PlotWeavingPage: React.FC = () => {
    const navigate = useNavigate();
    const [novels, setNovels] = useState<Novel[]>([]);
    const [selectedNovelId, setSelectedNovelId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchNovels();
    }, []);

    const fetchNovels = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/novel/list?page=1&pageSize=100');
            const result = await response.json();
            if (result.code === 200) {
                const parsedNovels = result.data.list.filter(
                    (n: Novel) => n.parseStatus === 'PARSED'
                );
                setNovels(parsedNovels);
                if (parsedNovels.length > 0) {
                    setSelectedNovelId(parsedNovels[0].id);
                }
            }
        } catch {
            message.error('获取小说列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleInterveneClick = () => {
        if (!selectedNovelId) {
            message.warning('请先选择一部小说');
            return;
        }
        navigate(`/weaving/${selectedNovelId}/intervene`);
    };

    const handlePredictClick = () => {
        if (!selectedNovelId) {
            message.warning('请先选择一部小说');
            return;
        }
        navigate(`/weaving/${selectedNovelId}/predict`);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <Title level={1}>
                    <span style={{ marginRight: 12 }}>🧶</span>
                    情节编织坊
                </Title>
                <Text type="secondary" style={{ fontSize: 16 }}>
                    干预已有情节或预测未来发展
                </Text>
            </div>

            <Card style={{ marginBottom: 32, borderRadius: 12 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={8}>
                        <Text strong>选择小说：</Text>
                    </Col>
                    <Col xs={24} sm={16}>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="请选择一部小说"
                            value={selectedNovelId}
                            onChange={setSelectedNovelId}
                            options={novels.map(n => ({
                                label: `${n.title} - ${n.author}`,
                                value: n.id
                            }))}
                        />
                    </Col>
                </Row>
            </Card>

            {novels.length === 0 ? (
                <Empty
                    description="暂无已解析的小说，请先上传并解析小说"
                    style={{ marginTop: 60 }}
                />
            ) : (
                <Row gutter={[24, 24]}>
                    <Col xs={24} md={12}>
                        <Card
                            hoverable
                            style={{
                                borderRadius: 16,
                                height: '100%',
                                border: '2px solid #f0f5ff',
                                transition: 'all 0.3s'
                            }}
                            bodyStyle={{
                                padding: 32,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center'
                            }}
                            onClick={handleInterveneClick}
                        >
                            <div style={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 24
                            }}>
                                <EditOutlined style={{ fontSize: 36, color: '#fff' }} />
                            </div>
                            <Title level={3} style={{ marginBottom: 12 }}>干预已有情节</Title>
                            <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.8 }}>
                                修改已经发生的情节，改变角色对话和行动，创造新的故事走向
                            </Text>
                            <div style={{ marginTop: 20 }}>
                                <Text type="secondary">
                                    <BookOutlined style={{ marginRight: 8 }} />
                                    修改现有情节
                                </Text>
                            </div>
                        </Card>
                    </Col>

                    <Col xs={24} md={12}>
                        <Card
                            hoverable
                            style={{
                                borderRadius: 16,
                                height: '100%',
                                border: '2px solid #f0f5ff',
                                transition: 'all 0.3s'
                            }}
                            bodyStyle={{
                                padding: 32,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center'
                            }}
                            onClick={handlePredictClick}
                        >
                            <div style={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 24
                            }}>
                                <BulbOutlined style={{ fontSize: 36, color: '#fff' }} />
                            </div>
                            <Title level={3} style={{ marginBottom: 12 }}>预测未来情节</Title>
                            <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.8 }}>
                                AI根据已有情节预测多种可能的后续发展，你可以选择或修改
                            </Text>
                            <div style={{ marginTop: 20 }}>
                                <Text type="secondary">
                                    <BulbOutlined style={{ marginRight: 8 }} />
                                    AI生成预测
                                </Text>
                            </div>
                        </Card>
                    </Col>
                </Row>
            )}
        </div>
    );
};

export default PlotWeavingPage;
