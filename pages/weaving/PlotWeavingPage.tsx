import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Row, Col, Select, Empty, Spin, message, Input, Button, Space } from 'antd';
import { EditOutlined, BulbOutlined, BookOutlined, SearchOutlined, FileTextOutlined, CrownOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface Novel {
    id: number;
    title: string;
    author: string;
    parseStatus: string;
}

const PlotWeavingPage: React.FC = () => {
    const navigate = useNavigate();
    const [novels, setNovels] = useState<Novel[]>([]);
    const [filteredNovels, setFilteredNovels] = useState<Novel[]>([]);
    const [selectedNovelId, setSelectedNovelId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        fetchNovels();
    }, []);

    useEffect(() => {
        if (!searchText.trim()) {
            setFilteredNovels(novels);
        } else {
            const q = searchText.toLowerCase();
            setFilteredNovels(novels.filter(n =>
                n.title.toLowerCase().includes(q) ||
                n.author.toLowerCase().includes(q) ||
                String(n.id).includes(q)
            ));
        }
    }, [searchText, novels]);

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
                setFilteredNovels(parsedNovels);
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

    const selectedNovel = novels.find(n => n.id === selectedNovelId);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(180deg, #f0f2f5 0%, #e6e9f0 100%)' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f0f2f5 0%, #e6e9f0 100%)' }}>
            {/* 顶部英雄区域 */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '48px 24px 64px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    pointerEvents: 'none'
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)', marginBottom: 16
                    }}>
                        <EditOutlined style={{ fontSize: 36, color: '#fff' }} />
                    </div>
                    <Title level={2} style={{ color: '#fff', margin: '0 0 8px 0' }}>
                        情节编织坊
                    </Title>
                    <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, margin: '0 auto', maxWidth: 400 }}>
                        干预已有情节或预测未来发展，编织属于你的故事
                    </Paragraph>
                </div>
            </div>

            <div style={{ maxWidth: 1000, margin: '-32px auto 0', padding: '0 24px 60px', position: 'relative', zIndex: 2 }}>
                {/* 选择小说卡片 */}
                <Card style={{
                    marginBottom: 32, borderRadius: 16, border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)',
                        padding: '16px 20px', marginBottom: 16,
                        borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 40, height: 40, borderRadius: 12,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        }}>
                            <BookOutlined style={{ fontSize: 20, color: '#fff' }} />
                        </div>
                        <div>
                            <Text strong style={{ fontSize: 15 }}>选择小说</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>选择一部已解析的小说开始编织</Text>
                        </div>
                    </div>

                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <Input
                            placeholder="搜索小说标题、作者或ID..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            allowClear
                            style={{ borderRadius: 10 }}
                        />
                        <Select
                            style={{ width: '100%' }}
                            placeholder="请选择一部小说"
                            value={selectedNovelId}
                            onChange={setSelectedNovelId}
                            showSearch
                            optionFilterProp="label"
                            options={filteredNovels.map(n => ({
                                label: (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{
                                            background: '#f0f2ff', color: '#667eea',
                                            padding: '1px 8px', borderRadius: 6, fontSize: 11,
                                            fontWeight: 'bold'
                                        }}>
                                            ID:{n.id}
                                        </span>
                                        <span>{n.title}</span>
                                        <span style={{ color: '#999', fontSize: 12 }}>- {n.author || '未知'}</span>
                                    </div>
                                ),
                                value: n.id
                            }))}
                        />
                        {selectedNovel && (
                            <div style={{
                                padding: '10px 14px', background: '#f8f9ff', borderRadius: 10,
                                border: '1px solid #e8ebff', display: 'flex', alignItems: 'center', gap: 10
                            }}>
                                <FileTextOutlined style={{ color: '#667eea' }} />
                                <Text strong>{selectedNovel.title}</Text>
                                <Text type="secondary">· {selectedNovel.author || '未知作者'}</Text>
                                <span style={{
                                    marginLeft: 'auto', background: '#667eea', color: '#fff',
                                    padding: '1px 8px', borderRadius: 6, fontSize: 11
                                }}>
                                    ID: {selectedNovel.id}
                                </span>
                            </div>
                        )}
                    </Space>
                </Card>

                {novels.length === 0 ? (
                    <Card style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                        <Empty
                            description="暂无已解析的小说，请先上传并解析小说"
                            style={{ marginTop: 20 }}
                        />
                    </Card>
                ) : (
                    <Row gutter={[24, 24]}>
                        <Col xs={24} md={12}>
                            <Card
                                hoverable
                                style={{
                                    borderRadius: 20, border: 'none',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                    height: '100%', overflow: 'hidden'
                                }}
                                styles={{ body: { padding: 0 } }}
                                onClick={handleInterveneClick}
                            >
                                <div style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    padding: '48px 32px', textAlign: 'center'
                                }}>
                                    <div style={{
                                        width: 96, height: 96, borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 20px'
                                    }}>
                                        <EditOutlined style={{ fontSize: 42, color: '#fff' }} />
                                    </div>
                                    <Title level={2} style={{ color: '#fff', margin: '0 0 12px 0' }}>干预已有情节</Title>
                                    <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, margin: 0 }}>
                                        修改已经发生的情节，改变角色对话和行动
                                    </Paragraph>
                                </div>
                                <div style={{ padding: '20px 32px', textAlign: 'center', background: '#fafbff' }}>
                                    <Text type="secondary" style={{ fontSize: 14 }}>
                                        <BookOutlined style={{ marginRight: 8 }} />
                                        选择现有情节进行修改、AI改写或生成分支
                                    </Text>
                                </div>
                            </Card>
                        </Col>

                        <Col xs={24} md={12}>
                            <Card
                                hoverable
                                style={{
                                    borderRadius: 20, border: 'none',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                    height: '100%', overflow: 'hidden'
                                }}
                                styles={{ body: { padding: 0 } }}
                                onClick={handlePredictClick}
                            >
                                <div style={{
                                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                    padding: '48px 32px', textAlign: 'center'
                                }}>
                                    <div style={{
                                        width: 96, height: 96, borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 20px'
                                    }}>
                                        <CrownOutlined style={{ fontSize: 42, color: '#fff' }} />
                                    </div>
                                    <Title level={2} style={{ color: '#fff', margin: '0 0 12px 0' }}>预测未来情节</Title>
                                    <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, margin: 0 }}>
                                        AI根据已有情节预测多种可能的后续发展
                                    </Paragraph>
                                </div>
                                <div style={{ padding: '20px 32px', textAlign: 'center', background: '#fffbfc' }}>
                                    <Text type="secondary" style={{ fontSize: 14 }}>
                                        <BulbOutlined style={{ marginRight: 8 }} />
                                        AI生成多种结局，选择或修改你喜欢的走向
                                    </Text>
                                </div>
                            </Card>
                        </Col>
                    </Row>
                )}
            </div>
        </div>
    );
};

export default PlotWeavingPage;
