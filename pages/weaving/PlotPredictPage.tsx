import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Button, Tag, Empty, Spin, message,
    Progress, Space, Divider, Modal, List
} from 'antd';
import {
    ArrowLeftOutlined, BulbOutlined,
    CheckOutlined, EditOutlined, EyeOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface Plot {
    id: number;
    chapterIndex: number;
    sceneIndex: number;
    title: string;
    content: string;
    isCompleted: boolean;
}

interface Prophecy {
    id: number;
    title: string;
    content: string;
    probability: number;
    endingType: string;
    keyFactors: string;
    involvedCharacterIds: string;
    isAdopted: boolean;
}

interface TownStatus {
    currentPlotIndex: number;
}

const endingTypeMap: Record<string, { color: string; text: string; emoji: string }> = {
    good: { color: 'green', text: '好结局', emoji: '⭐' },
    bad: { color: 'red', text: '坏结局', emoji: '💀' },
    hidden: { color: 'gold', text: '隐藏结局', emoji: '🌟' },
    tragic: { color: 'purple', text: '悲剧结局', emoji: '💔' },
    normal: { color: 'blue', text: '普通结局', emoji: '📖' }
};

const PlotPredictPage: React.FC = () => {
    const { novelId } = useParams<{ novelId: string }>();
    const navigate = useNavigate();
    const [plots, setPlots] = useState<Plot[]>([]);
    const [townStatus, setTownStatus] = useState<TownStatus | null>(null);
    const [prophecies, setProphecies] = useState<Prophecy[]>([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [selectedProphecy, setSelectedProphecy] = useState<Prophecy | null>(null);
    const [detailVisible, setDetailVisible] = useState(false);

    useEffect(() => {
        if (novelId) {
            fetchData();
        }
    }, [novelId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [plotsRes, statusRes, propheciesRes] = await Promise.all([
                fetch(`/api/novel/${novelId}/plots`),
                fetch(`/api/town/${novelId}/progress`),
                fetch(`/api/prophecy/${novelId}/list`)
            ]);

            const plotsResult = await plotsRes.json();
            const statusResult = await statusRes.json();
            const propheciesResult = await propheciesRes.json();

            if (plotsResult.code === 200) {
                setPlots(plotsResult.data.plots || []);
            }

            if (statusResult.code === 200) {
                setTownStatus(statusResult.data);
            }

            if (propheciesResult.code === 200) {
                setProphecies(propheciesResult.data.prophecies || []);
            }
        } catch {
            message.error('获取数据失败');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateProphecies = async () => {
        if (!novelId) return;

        setGenerating(true);
        try {
            const response = await fetch(`/api/prophecy/${novelId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            if (result.code === 200) {
                setProphecies(result.data.prophecies || []);
                message.success('预言生成成功！');
            } else {
                message.error(result.message || '预言生成失败');
            }
        } catch {
            message.error('预言生成失败');
        } finally {
            setGenerating(false);
        }
    };

    const handleAdoptProphecy = async (prophecyId: number) => {
        try {
            const response = await fetch(`/api/prophecy/${prophecyId}/adopt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            if (result.code === 200) {
                message.success('预言已采用！新情节已添加。');
                fetchData();
            } else {
                message.error(result.message || '采用失败');
            }
        } catch {
            message.error('采用失败');
        }
    };

    const handleViewProphecy = (prophecy: Prophecy) => {
        setSelectedProphecy(prophecy);
        setDetailVisible(true);
    };

    const getCurrentProgress = () => {
        if (!townStatus || plots.length === 0) return { current: 0, total: 0 };
        return {
            current: townStatus.currentPlotIndex,
            total: plots.length
        };
    };

    const progress = getCurrentProgress();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/weaving')}
                >
                    返回编织坊
                </Button>
            </div>

            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <Title level={2} style={{ margin: 0 }}>
                    <BulbOutlined style={{ marginRight: 12 }} />
                    预测未来情节
                </Title>
                <Text type="secondary">
                    AI根据已有情节预测可能的后续发展
                </Text>
            </Card>

            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <Title level={5}>当前进度</Title>
                <Progress
                    percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                    format={() => `${progress.current}/${progress.total} 个情节`}
                    strokeColor={{
                        '0%': '#667eea',
                        '100%': '#764ba2'
                    }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                    预测将基于当前进度之前的情节生成
                </Text>
            </Card>

            <Card style={{ marginBottom: 24, borderRadius: 12, textAlign: 'center' }}>
                <Button
                    type="primary"
                    size="large"
                    icon={<BulbOutlined />}
                    onClick={handleGenerateProphecies}
                    loading={generating}
                    style={{
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        border: 'none',
                        height: 48,
                        paddingLeft: 32,
                        paddingRight: 32
                    }}
                >
                    {generating ? '正在生成预言...' : '生成预言'}
                </Button>
                <div style={{ marginTop: 12 }}>
                    <Text type="secondary">
                        AI将生成多个可能的后续发展
                    </Text>
                </div>
            </Card>

            {prophecies.length > 0 && (
                <>
                    <Divider>生成的预言</Divider>
                    <List
                        dataSource={prophecies}
                        renderItem={(prophecy) => {
                            const ending = endingTypeMap[prophecy.endingType] || endingTypeMap.normal;
                            return (
                                <Card
                                    key={prophecy.id}
                                    style={{
                                        marginBottom: 16,
                                        borderRadius: 12,
                                        border: prophecy.isAdopted ? '2px solid #52c41a' : '1px solid #f0f0f0'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <Space>
                                                <Tag color={ending.color}>
                                                    {ending.emoji} {ending.text}
                                                </Tag>
                                                {prophecy.isAdopted && (
                                                    <Tag color="green">已采用</Tag>
                                                )}
                                            </Space>
                                            <Title level={4} style={{ margin: '8px 0' }}>
                                                {prophecy.title}
                                            </Title>
                                            <Paragraph ellipsis={{ rows: 2 }}>
                                                {prophecy.content}
                                            </Paragraph>
                                            <div style={{ marginBottom: 8 }}>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    概率：
                                                </Text>
                                                <Progress
                                                    percent={prophecy.probability}
                                                    size="small"
                                                    style={{ width: 120, marginLeft: 8 }}
                                                    strokeColor="#f5576c"
                                                />
                                            </div>
                                        </div>
                                        <Space direction="vertical">
                                            <Button
                                                icon={<EyeOutlined />}
                                                onClick={() => handleViewProphecy(prophecy)}
                                            >
                                                查看
                                            </Button>
                                            <Button
                                                icon={<EditOutlined />}
                                                onClick={() => message.info('预言修改功能开发中')}
                                            >
                                                修改
                                            </Button>
                                            {!prophecy.isAdopted && (
                                                <Button
                                                    type="primary"
                                                    icon={<CheckOutlined />}
                                                    onClick={() => handleAdoptProphecy(prophecy.id)}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        border: 'none'
                                                    }}
                                                >
                                                    采用
                                                </Button>
                                            )}
                                        </Space>
                                    </div>
                                </Card>
                            );
                        }}
                    />
                </>
            )}

            {prophecies.length === 0 && !generating && (
                <Empty
                    description="暂无预言，点击上方按钮生成预测"
                    style={{ marginTop: 40 }}
                />
            )}

            <Modal
                title={`预言详情：${selectedProphecy?.title}`}
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailVisible(false)}>
                        关闭
                    </Button>,
                    <Button
                        key="modify"
                        icon={<EditOutlined />}
                        onClick={() => {
                            setDetailVisible(false);
                            message.info('预言修改功能开发中');
                        }}
                    >
                        修改
                    </Button>,
                    selectedProphecy && !selectedProphecy.isAdopted && (
                        <Button
                            key="adopt"
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={() => {
                                setDetailVisible(false);
                                if (selectedProphecy) {
                                    handleAdoptProphecy(selectedProphecy.id);
                                }
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none'
                            }}
                        >
                            采用此预言
                        </Button>
                    )
                ]}
                width={700}
            >
                {selectedProphecy && (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <Space>
                                <Tag color={endingTypeMap[selectedProphecy.endingType]?.color || 'blue'}>
                                    {endingTypeMap[selectedProphecy.endingType]?.emoji}
                                    {endingTypeMap[selectedProphecy.endingType]?.text}
                                </Tag>
                            </Space>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <Text strong>概率：</Text>
                            <Progress
                                percent={selectedProphecy.probability}
                                strokeColor="#f5576c"
                            />
                        </div>

                        <Divider />

                        <div style={{ marginBottom: 16 }}>
                            <Text strong>预言内容：</Text>
                            <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                                {selectedProphecy.content}
                            </Paragraph>
                        </div>

                        {selectedProphecy.keyFactors && (
                            <div style={{ marginBottom: 16 }}>
                                <Text strong>关键因素：</Text>
                                <div style={{ marginTop: 8 }}>
                                    {JSON.parse(selectedProphecy.keyFactors || '[]').map(
                                        (factor: string, idx: number) => (
                                            <Tag key={idx} style={{ marginBottom: 4 }}>
                                                {factor}
                                            </Tag>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Modal>
        </div>
    );
};

export default PlotPredictPage;
