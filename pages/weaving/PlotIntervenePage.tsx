import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Button, Tag, Empty, Spin, message,
    Modal, Descriptions, Divider, Space, Badge, Row, Col
} from 'antd';
import {
    ArrowLeftOutlined, EyeOutlined, EditOutlined,
    CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined,
    EnvironmentOutlined, BookOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface Plot {
    id: number;
    novelId: number;
    chapterIndex: number;
    sceneIndex: number;
    title: string;
    content: string;
    dialogueContent: string;
    narrationContent: string;
    location: string;
    involvedCharacterIds: string;
    isCompleted: boolean;
    source: string;
    completedAt: string | null;
    createdAt: string;
}

interface TownStatus {
    currentPlotIndex: number;
    currentDialogueIndex: number;
}

const sourceStyleMap: Record<string, { color: string; text: string; bg: string }> = {
    original: { color: '#1890ff', text: '原小说', bg: '#e6f7ff' },
    prophecy: { color: '#722ed1', text: '预言', bg: '#f9f0ff' },
    modified: { color: '#fa8c16', text: '已修改', bg: '#fff7e6' }
};

const PlotIntervenePage: React.FC = () => {
    const { novelId } = useParams<{ novelId: string }>();
    const navigate = useNavigate();
    const [plots, setPlots] = useState<Plot[]>([]);
    const [townStatus, setTownStatus] = useState<TownStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);

    useEffect(() => {
        if (novelId) { fetchData(); }
    }, [novelId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [plotsRes, statusRes] = await Promise.all([
                fetch(`/api/novel/${novelId}/plots`),
                fetch(`/api/town/${novelId}/progress`)
            ]);
            const plotsResult = await plotsRes.json();
            const statusResult = await statusRes.json();
            if (plotsResult.code === 200) { setPlots(plotsResult.data.plots || []); }
            if (statusResult.code === 200) { setTownStatus(statusResult.data); }
        } catch { message.error('获取数据失败'); }
        finally { setLoading(false); }
    };

    const handleViewDetail = (plot: Plot) => {
        setSelectedPlot(plot);
        setDetailVisible(true);
    };

    const handleIntervene = (plot: Plot) => {
        navigate(`/weaving/${novelId}/intervene/${plot.id}`);
    };

    const getPlotStatus = (plot: Plot, index: number) => {
        if (plot.isCompleted) return { text: '已模拟', color: 'success', dot: '#52c41a' };
        if (townStatus && index === townStatus.currentPlotIndex) return { text: '当前', color: 'processing', dot: '#1890ff' };
        return { text: '未模拟', color: 'default', dot: '#d9d9d9' };
    };

    const getSourceTag = (source: string) => {
        const s = sourceStyleMap[source] || sourceStyleMap.original;
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '1px 10px', borderRadius: 10, fontSize: 12,
                color: s.color, background: s.bg
            }}>
                {s.text}
            </span>
        );
    };

    const parseDialogueContent = (dialogueContent: string) => {
        try { return JSON.parse(dialogueContent || '[]'); }
        catch { return []; }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(180deg, #f0f2f5 0%, #e6e9f0 100%)' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f0f2f5 0%, #e6e9f0 100%)' }}>
            {/* 顶部区域 */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '24px 24px 48px',
                position: 'relative', overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    pointerEvents: 'none'
                }} />
                <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/weaving')}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, marginBottom: 16 }}
                    >
                        返回编织坊
                    </Button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 48, height: 48, borderRadius: 14,
                            background: 'rgba(255,255,255,0.2)'
                        }}>
                            <EditOutlined style={{ fontSize: 24, color: '#fff' }} />
                        </div>
                        <div>
                            <Title level={3} style={{ color: '#fff', margin: 0 }}>干预已有情节</Title>
                            <Text style={{ color: 'rgba(255,255,255,0.75)' }}>选择一个情节进行修改</Text>
                        </div>
                    </div>
                </div>
            </div>

            {/* 情节列表 */}
            <div style={{ maxWidth: 900, margin: '-24px auto 0', padding: '0 24px 60px', position: 'relative', zIndex: 2 }}>
                {plots.length === 0 ? (
                    <Card style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                        <Empty description="暂无情节" />
                    </Card>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {plots.map((plot, index) => {
                            const status = getPlotStatus(plot, index);
                            return (
                                <Card
                                    key={plot.id}
                                    hoverable
                                    style={{
                                        borderRadius: 14, border: 'none',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                                        position: 'relative', overflow: 'hidden'
                                    }}
                                    styles={{ body: { padding: 0 } }}
                                >
                                    {/* 左侧状态色条 */}
                                    <div style={{
                                        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                                        background: status.dot === '#52c41a'
                                            ? 'linear-gradient(180deg, #52c41a, #73d13d)'
                                            : status.dot === '#1890ff'
                                                ? 'linear-gradient(180deg, #1890ff, #40a9ff)'
                                                : 'linear-gradient(180deg, #d9d9d9, #e8e8e8)'
                                    }} />

                                    <div style={{ padding: '16px 20px 16px 24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                                            {/* 左侧内容 */}
                                            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        padding: '2px 8px', borderRadius: 8, fontSize: 11,
                                                        color: status.dot, background: status.dot + '15'
                                                    }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: status.dot }} />
                                                        {status.text}
                                                    </span>
                                                    {getSourceTag(plot.source)}
                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                        第{plot.chapterIndex}章 第{plot.sceneIndex}节
                                                    </Text>
                                                </div>

                                                <Title level={5} ellipsis style={{ margin: '0 0 6px 0' }}>
                                                    {plot.title}
                                                </Title>

                                                <Paragraph
                                                    type="secondary"
                                                    ellipsis={{ rows: 2 }}
                                                    style={{ fontSize: 13, marginBottom: 6 }}
                                                >
                                                    {plot.content || plot.narrationContent || '暂无描述'}
                                                </Paragraph>

                                                {plot.location && (
                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                        <EnvironmentOutlined style={{ marginRight: 4 }} />
                                                        {plot.location}
                                                    </Text>
                                                )}
                                            </div>

                                            {/* 右侧按钮 */}
                                            <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <Button
                                                    icon={<EyeOutlined />}
                                                    onClick={() => handleViewDetail(plot)}
                                                    style={{ borderRadius: 8, minWidth: 80 }}
                                                >
                                                    查看
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    icon={<EditOutlined />}
                                                    onClick={() => handleIntervene(plot)}
                                                    style={{
                                                        borderRadius: 8, minWidth: 80,
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        border: 'none'
                                                    }}
                                                >
                                                    干预
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 详情弹窗 */}
            <Modal
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={700}
                styles={{ body: { padding: 0 } }}
            >
                {selectedPlot && (() => {
                    const source = sourceStyleMap[selectedPlot.source] || sourceStyleMap.original;
                    return (
                        <>
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                padding: '20px 24px', color: '#fff', position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                                    opacity: 0.3, pointerEvents: 'none'
                                }} />
                                <Space style={{ marginBottom: 8 }}>
                                    <Tag style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8 }}>
                                        第{selectedPlot.chapterIndex}章 第{selectedPlot.sceneIndex}节
                                    </Tag>
                                    <Tag style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8 }}>
                                        {source.text}
                                    </Tag>
                                </Space>
                                <Title level={3} style={{ color: '#fff', margin: 0 }}>{selectedPlot.title}</Title>
                            </div>
                            <div style={{ padding: 20 }}>
                                {selectedPlot.location && (
                                    <div style={{ marginBottom: 12, padding: 10, background: '#f8f9ff', borderRadius: 8 }}>
                                        <EnvironmentOutlined style={{ marginRight: 6, color: '#667eea' }} />
                                        <Text>{selectedPlot.location}</Text>
                                    </div>
                                )}
                                <div style={{ marginBottom: 16 }}>
                                    <Text strong style={{ display: 'block', marginBottom: 8 }}>内容概述</Text>
                                    <div style={{
                                        padding: 14, background: '#fafafa', borderRadius: 10,
                                        borderLeft: '4px solid #667eea', maxHeight: 200, overflow: 'auto'
                                    }}>
                                        <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                                            {selectedPlot.content || selectedPlot.narrationContent || '暂无内容'}
                                        </Paragraph>
                                    </div>
                                </div>
                                {parseDialogueContent(selectedPlot.dialogueContent).length > 0 && (
                                    <div style={{ marginBottom: 16 }}>
                                        <Text strong style={{ display: 'block', marginBottom: 8 }}>对话内容</Text>
                                        <div style={{ maxHeight: 250, overflow: 'auto' }}>
                                            {parseDialogueContent(selectedPlot.dialogueContent).map((line: string, idx: number) => (
                                                <div key={idx} style={{
                                                    marginBottom: 6, padding: 8, background: '#f8f9ff',
                                                    borderRadius: 8, borderLeft: '3px solid #667eea'
                                                }}>
                                                    <Text style={{ fontSize: 13 }}>{line}</Text>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    <Button onClick={() => setDetailVisible(false)} style={{ borderRadius: 8 }}>关闭</Button>
                                    <Button
                                        type="primary"
                                        icon={<EditOutlined />}
                                        onClick={() => { setDetailVisible(false); handleIntervene(selectedPlot); }}
                                        style={{ borderRadius: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}
                                    >
                                        干预此情节
                                    </Button>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default PlotIntervenePage;
