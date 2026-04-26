import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Button, Tag, Empty, Spin, message,
    Progress, Space, Divider, Modal, List
} from 'antd';
import {
    ArrowLeftOutlined, BulbOutlined, SyncOutlined,
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
    good: { color: 'green', text: 'Good Ending', emoji: '⭐' },
    bad: { color: 'red', text: 'Bad Ending', emoji: '💀' },
    hidden: { color: 'gold', text: 'Hidden Ending', emoji: '🌟' },
    tragic: { color: 'purple', text: 'Tragic Ending', emoji: '💔' },
    normal: { color: 'blue', text: 'Normal Ending', emoji: '📖' }
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
        } catch (error) {
            message.error('Failed to fetch data');
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
                message.success('Prophecies generated successfully!');
            } else {
                message.error(result.message || 'Failed to generate prophecies');
            }
        } catch (error) {
            message.error('Failed to generate prophecies');
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
                message.success('Prophecy adopted! New plots have been added.');
                fetchData();
            } else {
                message.error(result.message || 'Failed to adopt prophecy');
            }
        } catch (error) {
            message.error('Failed to adopt prophecy');
        }
    };

    const handleViewProphecy = (prophecy: Prophecy) => {
        setSelectedProphecy(prophecy);
        setDetailVisible(true);
    };

    const handleInterveneProphecy = (prophecy: Prophecy) => {
        navigate(`/weaving/${novelId}/predict/${prophecy.id}/intervene`);
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
                    Back to Workshop
                </Button>
            </div>

            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <Title level={2} style={{ margin: 0 }}>
                    <BulbOutlined style={{ marginRight: 12 }} />
                    Predict Future Plots
                </Title>
                <Text type="secondary">
                    AI predicts possible future developments based on existing plots
                </Text>
            </Card>

            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <Title level={5}>Current Progress</Title>
                <Progress
                    percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                    format={() => `${progress.current}/${progress.total} plots`}
                    strokeColor={{
                        '0%': '#667eea',
                        '100%': '#764ba2'
                    }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Predictions will be based on plots up to the current progress
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
                    {generating ? 'Generating Prophecies...' : 'Generate Prophecies'}
                </Button>
                <div style={{ marginTop: 12 }}>
                    <Text type="secondary">
                        AI will generate multiple possible future developments
                    </Text>
                </div>
            </Card>

            {prophecies.length > 0 && (
                <>
                    <Divider>Generated Prophecies</Divider>
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
                                                    <Tag color="green">Adopted</Tag>
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
                                                    Probability:
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
                                                View
                                            </Button>
                                            <Button
                                                icon={<EditOutlined />}
                                                onClick={() => handleInterveneProphecy(prophecy)}
                                            >
                                                Modify
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
                                                    Adopt
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
                    description="No prophecies yet. Click the button above to generate predictions."
                    style={{ marginTop: 40 }}
                />
            )}

            <Modal
                title={`Prophecy: ${selectedProphecy?.title}`}
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailVisible(false)}>
                        Close
                    </Button>,
                    <Button
                        key="modify"
                        icon={<EditOutlined />}
                        onClick={() => {
                            setDetailVisible(false);
                            if (selectedProphecy) {
                                handleInterveneProphecy(selectedProphecy);
                            }
                        }}
                    >
                        Modify
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
                            Adopt This Prophecy
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
                            <Text strong>Probability:</Text>
                            <Progress
                                percent={selectedProphecy.probability}
                                strokeColor="#f5576c"
                            />
                        </div>

                        <Divider />

                        <div style={{ marginBottom: 16 }}>
                            <Text strong>Prophecy Content:</Text>
                            <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                                {selectedProphecy.content}
                            </Paragraph>
                        </div>

                        {selectedProphecy.keyFactors && (
                            <div style={{ marginBottom: 16 }}>
                                <Text strong>Key Factors:</Text>
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
