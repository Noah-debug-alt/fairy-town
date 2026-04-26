import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Typography, List, Button, Tag, Empty, Spin, message,
    Modal, Descriptions, Divider, Space, Badge
} from 'antd';
import {
    ArrowLeftOutlined, EyeOutlined, EditOutlined,
    CheckCircleOutlined, ClockCircleOutlined
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

const PlotIntervenePage: React.FC = () => {
    const { novelId } = useParams<{ novelId: string }>();
    const navigate = useNavigate();
    const [plots, setPlots] = useState<Plot[]>([]);
    const [townStatus, setTownStatus] = useState<TownStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);

    useEffect(() => {
        if (novelId) {
            fetchData();
        }
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

            if (plotsResult.code === 200) {
                setPlots(plotsResult.data.plots || []);
            }

            if (statusResult.code === 200) {
                setTownStatus(statusResult.data);
            }
        } catch (error) {
            message.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = (plot: Plot) => {
        setSelectedPlot(plot);
        setDetailVisible(true);
    };

    const handleIntervene = (plot: Plot) => {
        navigate(`/weaving/${novelId}/intervene/${plot.id}`);
    };

    const getPlotStatus = (plot: Plot, index: number) => {
        if (plot.isCompleted) {
            return { text: 'Simulated', color: 'success', icon: <CheckCircleOutlined /> };
        }
        if (townStatus && index === townStatus.currentPlotIndex) {
            return { text: 'Current', color: 'processing', icon: <ClockCircleOutlined /> };
        }
        return { text: 'Pending', color: 'default', icon: null };
    };

    const getSourceTag = (source: string) => {
        const sourceMap: Record<string, { color: string; text: string }> = {
            original: { color: 'blue', text: 'Original' },
            prophecy: { color: 'purple', text: 'Prophecy' },
            modified: { color: 'orange', text: 'Modified' }
        };
        const s = sourceMap[source] || sourceMap.original;
        return <Tag color={s.color}>{s.text}</Tag>;
    };

    const parseDialogueContent = (dialogueContent: string) => {
        try {
            return JSON.parse(dialogueContent || '[]');
        } catch {
            return [];
        }
    };

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
                    <EditOutlined style={{ marginRight: 12 }} />
                    Intervene Existing Plots
                </Title>
                <Text type="secondary">
                    Select a plot to modify its content, dialogues, and actions
                </Text>
            </Card>

            {plots.length === 0 ? (
                <Empty description="No plots available" />
            ) : (
                <List
                    dataSource={plots}
                    renderItem={(plot, index) => {
                        const status = getPlotStatus(plot, index);
                        return (
                            <Card
                                key={plot.id}
                                style={{
                                    marginBottom: 16,
                                    borderRadius: 12,
                                    border: status.color === 'processing' 
                                        ? '2px solid #1890ff' 
                                        : '1px solid #f0f0f0'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <Space>
                                            <Badge status={status.color as any} />
                                            <Text strong style={{ fontSize: 16 }}>
                                                Chapter {plot.chapterIndex} Scene {plot.sceneIndex}
                                            </Text>
                                            {getSourceTag(plot.source)}
                                            {status.icon && <Tag color={status.color}>{status.text}</Tag>}
                                        </Space>
                                        <Title level={4} style={{ margin: '8px 0' }}>
                                            {plot.title}
                                        </Title>
                                        <Text type="secondary" ellipsis style={{ display: 'block' }}>
                                            {plot.content || plot.narrationContent || 'No description'}
                                        </Text>
                                        {plot.location && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                Location: {plot.location}
                                            </Text>
                                        )}
                                    </div>
                                    <Space direction="vertical">
                                        <Button
                                            icon={<EyeOutlined />}
                                            onClick={() => handleViewDetail(plot)}
                                        >
                                            View
                                        </Button>
                                        <Button
                                            type="primary"
                                            icon={<EditOutlined />}
                                            onClick={() => handleIntervene(plot)}
                                        >
                                            Intervene
                                        </Button>
                                    </Space>
                                </div>
                            </Card>
                        );
                    }}
                />
            )}

            <Modal
                title={`Plot Details: ${selectedPlot?.title}`}
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailVisible(false)}>
                        Close
                    </Button>,
                    <Button
                        key="intervene"
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => {
                            setDetailVisible(false);
                            if (selectedPlot) {
                                handleIntervene(selectedPlot);
                            }
                        }}
                    >
                        Intervene This Plot
                    </Button>
                ]}
                width={700}
            >
                {selectedPlot && (
                    <>
                        <Descriptions column={2} size="small">
                            <Descriptions.Item label="Chapter">
                                Chapter {selectedPlot.chapterIndex} Scene {selectedPlot.sceneIndex}
                            </Descriptions.Item>
                            <Descriptions.Item label="Location">
                                {selectedPlot.location || 'Not specified'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Source">
                                {getSourceTag(selectedPlot.source)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Status">
                                {selectedPlot.isCompleted ? 'Simulated' : 'Pending'}
                            </Descriptions.Item>
                        </Descriptions>

                        <Divider />

                        <div style={{ marginBottom: 16 }}>
                            <Text strong>Content Overview:</Text>
                            <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                                {selectedPlot.content || selectedPlot.narrationContent || 'No content'}
                            </Paragraph>
                        </div>

                        {parseDialogueContent(selectedPlot.dialogueContent).length > 0 && (
                            <div>
                                <Text strong>Dialogue Content:</Text>
                                <div style={{ 
                                    marginTop: 8, 
                                    maxHeight: 300, 
                                    overflow: 'auto',
                                    background: '#fafafa',
                                    padding: 12,
                                    borderRadius: 8
                                }}>
                                    {parseDialogueContent(selectedPlot.dialogueContent).map(
                                        (line: string, idx: number) => (
                                            <div key={idx} style={{ marginBottom: 8 }}>
                                                <Text>{line}</Text>
                                            </div>
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

export default PlotIntervenePage;
