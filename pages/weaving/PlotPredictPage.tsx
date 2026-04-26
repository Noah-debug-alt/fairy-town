import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Button, Tag, Empty, Spin, message,
    Progress, Space, Divider, Modal, Row, Col, Tooltip
} from 'antd';
import {
    ArrowLeftOutlined, BulbOutlined,
    CheckOutlined, EditOutlined, EyeOutlined,
    StarFilled, ThunderboltFilled, FireFilled,
    HeartFilled, BookFilled, ClockCircleOutlined,
    RocketOutlined, CrownOutlined
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

const endingTypeConfig: Record<string, {
    color: string;
    text: string;
    icon: React.ReactNode;
    gradient: string;
    bgGradient: string;
}> = {
    good: {
        color: '#52c41a',
        text: '好结局',
        icon: <StarFilled />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
        bgGradient: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)'
    },
    bad: {
        color: '#ff4d4f',
        text: '坏结局',
        icon: <ThunderboltFilled />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        bgGradient: 'linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%)'
    },
    hidden: {
        color: '#faad14',
        text: '隐藏结局',
        icon: <StarFilled />,
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
        bgGradient: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)'
    },
    tragic: {
        color: '#722ed1',
        text: '悲剧结局',
        icon: <HeartFilled />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
        bgGradient: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)'
    },
    normal: {
        color: '#1890ff',
        text: '普通结局',
        icon: <BookFilled />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
        bgGradient: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)'
    }
};

const cardStyle: React.CSSProperties = {
    borderRadius: 16,
    border: 'none',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    transition: 'all 0.3s ease'
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
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #f0f2f5 0%, #e6e9f0 100%)',
            paddingBottom: 40
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '24px 24px 48px',
                marginBottom: -24
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/weaving')}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: '#fff'
                        }}
                    >
                        返回编织坊
                    </Button>

                    <div style={{ textAlign: 'center', marginTop: 24 }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.2)',
                            marginBottom: 16
                        }}>
                            <CrownOutlined style={{ fontSize: 40, color: '#fff' }} />
                        </div>
                        <Title level={2} style={{ color: '#fff', margin: 0 }}>
                            命运预言台
                        </Title>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>
                            AI根据已有情节预测可能的后续发展
                        </Text>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
                <Row gutter={[24, 24]}>
                    <Col xs={24} md={8}>
                        <Card
                            style={{
                                ...cardStyle,
                                background: 'linear-gradient(135deg, #fff 0%, #f8f9ff 100%)'
                            }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <ClockCircleOutlined style={{ fontSize: 32, color: '#667eea', marginBottom: 12 }} />
                                <Title level={5} style={{ margin: '0 0 8px 0' }}>当前进度</Title>
                                <Progress
                                    type="circle"
                                    percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                                    format={() => (
                                        <span style={{ fontSize: 14 }}>
                                            <span style={{ fontSize: 24, fontWeight: 'bold', color: '#667eea' }}>
                                                {progress.current}
                                            </span>
                                            <span style={{ color: '#999' }}>/{progress.total}</span>
                                        </span>
                                    )}
                                    strokeColor={{
                                        '0%': '#667eea',
                                        '100%': '#764ba2'
                                    }}
                                    trailColor="#f0f0f0"
                                />
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                                    预测基于当前进度之前的情节
                                </Text>
                            </div>
                        </Card>
                    </Col>

                    <Col xs={24} md={16}>
                        <Card
                            style={{
                                ...cardStyle,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: '#fff'
                            }}
                        >
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <RocketOutlined style={{ fontSize: 36, marginBottom: 16 }} />
                                <Title level={4} style={{ color: '#fff', margin: '0 0 8px 0' }}>
                                    启动命运预测
                                </Title>
                                <Text style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 20 }}>
                                    AI将分析已有情节，生成多个可能的后续发展
                                </Text>
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<BulbOutlined />}
                                    onClick={handleGenerateProphecies}
                                    loading={generating}
                                    style={{
                                        background: '#fff',
                                        border: 'none',
                                        color: '#667eea',
                                        height: 48,
                                        paddingLeft: 32,
                                        paddingRight: 32,
                                        borderRadius: 24,
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    {generating ? '正在生成预言...' : '生成预言'}
                                </Button>
                            </div>
                        </Card>
                    </Col>
                </Row>

                {prophecies.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                        <Divider style={{
                            fontSize: 18,
                            color: '#667eea',
                            fontWeight: 'bold'
                        }}>
                            <FireFilled style={{ marginRight: 8 }} />
                            命运预言
                        </Divider>

                        <Row gutter={[20, 20]}>
                            {prophecies.map((prophecy, index) => {
                                const ending = endingTypeConfig[prophecy.endingType] || endingTypeConfig.normal;
                                return (
                                    <Col xs={24} sm={12} lg={8} key={prophecy.id}>
                                        <Card
                                            style={{
                                                ...cardStyle,
                                                background: ending.bgGradient,
                                                height: '100%',
                                                border: prophecy.isAdopted
                                                    ? '2px solid #52c41a'
                                                    : '1px solid rgba(0,0,0,0.05)',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                            bodyStyle={{ padding: 20 }}
                                            hoverable
                                        >
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                right: 0,
                                                width: 60,
                                                height: 60,
                                                background: ending.gradient,
                                                clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                justifyContent: 'flex-end',
                                                paddingRight: 8,
                                                paddingTop: 8
                                            }}>
                                                <span style={{ color: '#fff', fontSize: 16 }}>
                                                    #{index + 1}
                                                </span>
                                            </div>

                                            <div style={{ marginBottom: 12 }}>
                                                <Tag
                                                    style={{
                                                        background: ending.gradient,
                                                        border: 'none',
                                                        color: '#fff',
                                                        padding: '2px 12px',
                                                        borderRadius: 12
                                                    }}
                                                >
                                                    {ending.icon} {ending.text}
                                                </Tag>
                                                {prophecy.isAdopted && (
                                                    <Tag
                                                        style={{
                                                            background: '#52c41a',
                                                            border: 'none',
                                                            color: '#fff',
                                                            marginLeft: 4,
                                                            borderRadius: 12
                                                        }}
                                                    >
                                                        已采用
                                                    </Tag>
                                                )}
                                            </div>

                                            <Title
                                                level={5}
                                                style={{
                                                    margin: '0 0 8px 0',
                                                    color: '#333',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {prophecy.title}
                                            </Title>

                                            <Paragraph
                                                ellipsis={{ rows: 3 }}
                                                style={{
                                                    color: '#666',
                                                    marginBottom: 12,
                                                    minHeight: 66
                                                }}
                                            >
                                                {prophecy.content}
                                            </Paragraph>

                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    marginBottom: 4
                                                }}>
                                                    <Text style={{ fontSize: 12, color: '#999' }}>
                                                        发生概率
                                                    </Text>
                                                    <Text style={{
                                                        fontSize: 14,
                                                        fontWeight: 'bold',
                                                        color: ending.color
                                                    }}>
                                                        {prophecy.probability}%
                                                    </Text>
                                                </div>
                                                <Progress
                                                    percent={prophecy.probability}
                                                    showInfo={false}
                                                    strokeColor={ending.color}
                                                    trailColor="rgba(0,0,0,0.05)"
                                                    size="small"
                                                />
                                            </div>

                                            <Space style={{ width: '100%' }} direction="vertical" size="small">
                                                <Button
                                                    icon={<EyeOutlined />}
                                                    onClick={() => handleViewProphecy(prophecy)}
                                                    block
                                                    style={{ borderRadius: 8 }}
                                                >
                                                    查看详情
                                                </Button>
                                                {!prophecy.isAdopted && (
                                                    <Button
                                                        type="primary"
                                                        icon={<CheckOutlined />}
                                                        onClick={() => handleAdoptProphecy(prophecy.id)}
                                                        block
                                                        style={{
                                                            background: ending.gradient,
                                                            border: 'none',
                                                            borderRadius: 8
                                                        }}
                                                    >
                                                        采用此预言
                                                    </Button>
                                                )}
                                            </Space>
                                        </Card>
                                    </Col>
                                );
                            })}
                        </Row>
                    </div>
                )}

                {prophecies.length === 0 && !generating && (
                    <Card style={{ ...cardStyle, marginTop: 24 }}>
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <span style={{ color: '#999' }}>
                                    暂无预言，点击上方按钮生成预测
                                </span>
                            }
                        />
                    </Card>
                )}
            </div>

            <Modal
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={700}
                styles={{
                    body: { padding: 0 }
                }}
            >
                {selectedProphecy && (() => {
                    const ending = endingTypeConfig[selectedProphecy.endingType] || endingTypeConfig.normal;
                    return (
                        <>
                            <div style={{
                                background: ending.gradient,
                                padding: '24px 24px 32px',
                                color: '#fff',
                                position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                                    opacity: 0.3
                                }} />
                                <Tag
                                    style={{
                                        background: 'rgba(255,255,255,0.3)',
                                        border: 'none',
                                        color: '#fff',
                                        padding: '4px 16px',
                                        borderRadius: 20,
                                        marginBottom: 12
                                    }}
                                >
                                    {ending.icon} {ending.text}
                                </Tag>
                                <Title level={3} style={{ color: '#fff', margin: 0 }}>
                                    {selectedProphecy.title}
                                </Title>
                            </div>

                            <div style={{ padding: 24 }}>
                                <div style={{
                                    marginBottom: 20,
                                    padding: 16,
                                    background: '#f8f9fa',
                                    borderRadius: 12
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 8
                                    }}>
                                        <Text strong>发生概率</Text>
                                        <Text style={{
                                            fontSize: 20,
                                            fontWeight: 'bold',
                                            color: ending.color
                                        }}>
                                            {selectedProphecy.probability}%
                                        </Text>
                                    </div>
                                    <Progress
                                        percent={selectedProphecy.probability}
                                        strokeColor={ending.gradient}
                                        trailColor="#e8e8e8"
                                    />
                                </div>

                                <div style={{ marginBottom: 20 }}>
                                    <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                        预言内容
                                    </Text>
                                    <div style={{
                                        padding: 16,
                                        background: '#fafafa',
                                        borderRadius: 8,
                                        borderLeft: `4px solid ${ending.color}`
                                    }}>
                                        <Paragraph style={{
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: 1.8
                                        }}>
                                            {selectedProphecy.content}
                                        </Paragraph>
                                    </div>
                                </div>

                                {selectedProphecy.keyFactors && (
                                    <div style={{ marginBottom: 20 }}>
                                        <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                            关键因素
                                        </Text>
                                        <div>
                                            {JSON.parse(selectedProphecy.keyFactors || '[]').map(
                                                (factor: string, idx: number) => (
                                                    <Tag
                                                        key={idx}
                                                        style={{
                                                            marginBottom: 8,
                                                            borderRadius: 16,
                                                            padding: '4px 12px'
                                                        }}
                                                    >
                                                        {factor}
                                                    </Tag>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}

                                <Divider style={{ margin: '24px 0' }} />

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: 12
                                }}>
                                    <Button
                                        onClick={() => setDetailVisible(false)}
                                        style={{ borderRadius: 8 }}
                                    >
                                        关闭
                                    </Button>
                                    <Tooltip title="功能开发中">
                                        <Button
                                            icon={<EditOutlined />}
                                            onClick={() => message.info('预言修改功能开发中')}
                                            style={{ borderRadius: 8 }}
                                        >
                                            修改
                                        </Button>
                                    </Tooltip>
                                    {!selectedProphecy.isAdopted && (
                                        <Button
                                            type="primary"
                                            icon={<CheckOutlined />}
                                            onClick={() => {
                                                setDetailVisible(false);
                                                handleAdoptProphecy(selectedProphecy.id);
                                            }}
                                            style={{
                                                background: ending.gradient,
                                                border: 'none',
                                                borderRadius: 8
                                            }}
                                        >
                                            采用此预言
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default PlotPredictPage;
