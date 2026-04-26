import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Button, Spin, message, Tabs, Input,
    List, Space, Tag, Divider, Modal, Radio
} from 'antd';
import {
    ArrowLeftOutlined, SaveOutlined, SyncOutlined,
    EditOutlined, RobotOutlined, BranchesOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

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
    source: string;
}

interface DialogueLine {
    speaker: string;
    content: string;
    emotion?: string;
    action?: string;
}

interface PlotBranch {
    label: string;
    description: string;
    dialogues: DialogueLine[];
}

const PlotInterveneDetailPage: React.FC = () => {
    const { novelId, plotId } = useParams<{ novelId: string; plotId: string }>();
    const navigate = useNavigate();
    const [plot, setPlot] = useState<Plot | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('manual');

    // Manual edit state
    const [editedTitle, setEditedTitle] = useState('');
    const [editedNarration, setEditedNarration] = useState('');
    const [editedDialogues, setEditedDialogues] = useState<DialogueLine[]>([]);

    // AI rewrite state
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiResult, setAiResult] = useState<DialogueLine[]>([]);
    const [aiGenerating, setAiGenerating] = useState(false);

    // Branch select state
    const [branches, setBranches] = useState<PlotBranch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
    const [branchGenerating, setBranchGenerating] = useState(false);

    useEffect(() => {
        if (plotId) {
            fetchPlot();
        }
    }, [plotId]);

    const fetchPlot = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/plot/${plotId}`);
            const result = await response.json();
            if (result.code === 200) {
                const plotData = result.data;
                setPlot(plotData);
                setEditedTitle(plotData.title);
                setEditedNarration(plotData.narrationContent || '');
                try {
                    const dialogues = JSON.parse(plotData.dialogueContent || '[]');
                    setEditedDialogues(Array.isArray(dialogues) ? dialogues : []);
                } catch {
                    setEditedDialogues([]);
                }
            } else {
                message.error('Failed to fetch plot');
            }
        } catch (error) {
            message.error('Failed to fetch plot');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveManualEdit = async () => {
        if (!plot) return;

        setSaving(true);
        try {
            const response = await fetch(`/api/plot/${plot.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editedTitle,
                    narrationContent: editedNarration,
                    dialogueContent: JSON.stringify(editedDialogues),
                    source: 'modified'
                })
            });

            const result = await response.json();
            if (result.code === 200) {
                message.success('Plot updated successfully');
                fetchPlot();
            } else {
                message.error(result.message || 'Failed to update plot');
            }
        } catch (error) {
            message.error('Failed to update plot');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateAiRewrite = async () => {
        if (!plot || !aiPrompt.trim()) {
            message.warning('Please enter your requirements');
            return;
        }

        setAiGenerating(true);
        try {
            const response = await fetch(`/api/plot/${plot.id}/ai-rewrite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt })
            });

            const result = await response.json();
            if (result.code === 200) {
                setAiResult(result.data.dialogues || []);
                message.success('AI rewrite generated');
            } else {
                message.error(result.message || 'Failed to generate AI rewrite');
            }
        } catch (error) {
            message.error('Failed to generate AI rewrite');
        } finally {
            setAiGenerating(false);
        }
    };

    const handleAdoptAiResult = async () => {
        if (aiResult.length === 0) {
            message.warning('No AI result to adopt');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`/api/plot/${plot!.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editedTitle,
                    narrationContent: editedNarration,
                    dialogueContent: JSON.stringify(aiResult),
                    source: 'modified'
                })
            });

            const result = await response.json();
            if (result.code === 200) {
                message.success('AI result adopted successfully');
                setEditedDialogues(aiResult);
                setAiResult([]);
                setActiveTab('manual');
                fetchPlot();
            } else {
                message.error(result.message || 'Failed to adopt AI result');
            }
        } catch (error) {
            message.error('Failed to adopt AI result');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateBranches = async () => {
        if (!plot) return;

        setBranchGenerating(true);
        try {
            const response = await fetch(`/api/plot/${plot.id}/generate-branches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            if (result.code === 200) {
                setBranches(result.data.branches || []);
                message.success('Branches generated');
            } else {
                message.error(result.message || 'Failed to generate branches');
            }
        } catch (error) {
            message.error('Failed to generate branches');
        } finally {
            setBranchGenerating(false);
        }
    };

    const handleSelectBranch = async () => {
        if (selectedBranch === null || !branches[selectedBranch]) {
            message.warning('Please select a branch');
            return;
        }

        setSaving(true);
        try {
            const branch = branches[selectedBranch];
            const response = await fetch(`/api/plot/${plot!.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editedTitle,
                    narrationContent: editedNarration,
                    dialogueContent: JSON.stringify(branch.dialogues),
                    source: 'modified'
                })
            });

            const result = await response.json();
            if (result.code === 200) {
                message.success('Branch selected and applied');
                setEditedDialogues(branch.dialogues);
                setBranches([]);
                setSelectedBranch(null);
                setActiveTab('manual');
                fetchPlot();
            } else {
                message.error(result.message || 'Failed to apply branch');
            }
        } catch (error) {
            message.error('Failed to apply branch');
        } finally {
            setSaving(false);
        }
    };

    const addDialogue = () => {
        setEditedDialogues([...editedDialogues, { speaker: '', content: '' }]);
    };

    const updateDialogue = (index: number, field: keyof DialogueLine, value: string) => {
        const newDialogues = [...editedDialogues];
        newDialogues[index] = { ...newDialogues[index], [field]: value };
        setEditedDialogues(newDialogues);
    };

    const removeDialogue = (index: number) => {
        const newDialogues = editedDialogues.filter((_, i) => i !== index);
        setEditedDialogues(newDialogues);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!plot) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Text>Plot not found</Text>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate(`/weaving/${novelId}/intervene`)}
                >
                    Back to Plot List
                </Button>
            </div>

            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <Space>
                    <Tag color="blue">Chapter {plot.chapterIndex} Scene {plot.sceneIndex}</Tag>
                    <Tag color={plot.source === 'modified' ? 'orange' : 'green'}>
                        {plot.source === 'modified' ? 'Modified' : 'Original'}
                    </Tag>
                </Space>
                <Title level={2} style={{ margin: '12px 0 0 0' }}>
                    <EditOutlined style={{ marginRight: 12 }} />
                    Intervene: {plot.title}
                </Title>
                <Text type="secondary">
                    Modify this plot's content, dialogues, and actions
                </Text>
            </Card>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'manual',
                        label: (
                            <span>
                                <EditOutlined />
                                Manual Edit
                            </span>
                        ),
                        children: (
                            <Card style={{ borderRadius: 12 }}>
                                <div style={{ marginBottom: 16 }}>
                                    <Text strong>Title:</Text>
                                    <Input
                                        value={editedTitle}
                                        onChange={(e) => setEditedTitle(e.target.value)}
                                        style={{ marginTop: 8 }}
                                    />
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                    <Text strong>Narration:</Text>
                                    <TextArea
                                        value={editedNarration}
                                        onChange={(e) => setEditedNarration(e.target.value)}
                                        rows={4}
                                        style={{ marginTop: 8 }}
                                    />
                                </div>

                                <Divider>Dialogue Content</Divider>

                                <List
                                    dataSource={editedDialogues}
                                    renderItem={(dialogue, index) => (
                                        <Card
                                            size="small"
                                            style={{ marginBottom: 12, borderRadius: 8 }}
                                        >
                                            <Space style={{ width: '100%' }} direction="vertical">
                                                <Input
                                                    placeholder="Speaker"
                                                    value={dialogue.speaker}
                                                    onChange={(e) => updateDialogue(index, 'speaker', e.target.value)}
                                                    style={{ width: 200 }}
                                                />
                                                <TextArea
                                                    placeholder="Dialogue content"
                                                    value={dialogue.content}
                                                    onChange={(e) => updateDialogue(index, 'content', e.target.value)}
                                                    rows={2}
                                                />
                                                <Input
                                                    placeholder="Emotion (optional)"
                                                    value={dialogue.emotion || ''}
                                                    onChange={(e) => updateDialogue(index, 'emotion', e.target.value)}
                                                    style={{ width: 200 }}
                                                />
                                                <Button
                                                    danger
                                                    size="small"
                                                    onClick={() => removeDialogue(index)}
                                                >
                                                    Remove
                                                </Button>
                                            </Space>
                                        </Card>
                                    )}
                                />

                                <Button
                                    type="dashed"
                                    onClick={addDialogue}
                                    style={{ width: '100%', marginBottom: 16 }}
                                >
                                    + Add Dialogue
                                </Button>

                                <div style={{ textAlign: 'right' }}>
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        onClick={handleSaveManualEdit}
                                        loading={saving}
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </Card>
                        )
                    },
                    {
                        key: 'ai',
                        label: (
                            <span>
                                <RobotOutlined />
                                AI Rewrite
                            </span>
                        ),
                        children: (
                            <Card style={{ borderRadius: 12 }}>
                                <div style={{ marginBottom: 16 }}>
                                    <Text strong>Describe your desired changes:</Text>
                                    <TextArea
                                        placeholder="e.g., Make the dialogue more emotional, add more tension between characters..."
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        rows={4}
                                        style={{ marginTop: 8 }}
                                    />
                                </div>

                                <Button
                                    type="primary"
                                    icon={<SyncOutlined spin={aiGenerating} />}
                                    onClick={handleGenerateAiRewrite}
                                    loading={aiGenerating}
                                    style={{ marginBottom: 24 }}
                                >
                                    Generate AI Rewrite
                                </Button>

                                {aiResult.length > 0 && (
                                    <>
                                        <Divider>AI Generated Result</Divider>
                                        <div style={{
                                            background: '#f5f5f5',
                                            padding: 16,
                                            borderRadius: 8,
                                            marginBottom: 16
                                        }}>
                                            {aiResult.map((line, idx) => (
                                                <div key={idx} style={{ marginBottom: 8 }}>
                                                    <Text strong>{line.speaker}: </Text>
                                                    <Text>{line.content}</Text>
                                                    {line.emotion && (
                                                        <Tag style={{ marginLeft: 8 }}>{line.emotion}</Tag>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <Space>
                                            <Button
                                                type="primary"
                                                onClick={handleAdoptAiResult}
                                                loading={saving}
                                            >
                                                Adopt This Version
                                            </Button>
                                            <Button onClick={() => setAiResult([])}>
                                                Discard
                                            </Button>
                                        </Space>
                                    </>
                                )}
                            </Card>
                        )
                    },
                    {
                        key: 'branch',
                        label: (
                            <span>
                                <BranchesOutlined />
                                Select Branch
                            </span>
                        ),
                        children: (
                            <Card style={{ borderRadius: 12 }}>
                                <Button
                                    type="primary"
                                    icon={<BranchesOutlined />}
                                    onClick={handleGenerateBranches}
                                    loading={branchGenerating}
                                    style={{ marginBottom: 24 }}
                                >
                                    Generate Branch Options
                                </Button>

                                {branches.length > 0 && (
                                    <>
                                        <Divider>Select a Branch</Divider>
                                        <Radio.Group
                                            value={selectedBranch}
                                            onChange={(e) => setSelectedBranch(e.target.value)}
                                            style={{ width: '100%' }}
                                        >
                                            <List
                                                dataSource={branches}
                                                renderItem={(branch, index) => (
                                                    <Card
                                                        size="small"
                                                        style={{
                                                            marginBottom: 12,
                                                            borderRadius: 8,
                                                            border: selectedBranch === index 
                                                                ? '2px solid #1890ff' 
                                                                : '1px solid #f0f0f0'
                                                        }}
                                                    >
                                                        <Radio value={index}>
                                                            <Text strong>{branch.label}</Text>
                                                        </Radio>
                                                        <Paragraph
                                                            type="secondary"
                                                            style={{ margin: '8px 0' }}
                                                        >
                                                            {branch.description}
                                                        </Paragraph>
                                                        <div style={{
                                                            background: '#fafafa',
                                                            padding: 8,
                                                            borderRadius: 4
                                                        }}>
                                                            {branch.dialogues.slice(0, 3).map((line, idx) => (
                                                                <Text key={idx} style={{ display: 'block' }}>
                                                                    {line.speaker}: {line.content}
                                                                </Text>
                                                            ))}
                                                            {branch.dialogues.length > 3 && (
                                                                <Text type="secondary">
                                                                    ... and {branch.dialogues.length - 3} more lines
                                                                </Text>
                                                            )}
                                                        </div>
                                                    </Card>
                                                )}
                                            />
                                        </Radio.Group>

                                        <div style={{ marginTop: 16, textAlign: 'right' }}>
                                            <Button
                                                type="primary"
                                                onClick={handleSelectBranch}
                                                loading={saving}
                                                disabled={selectedBranch === null}
                                            >
                                                Apply Selected Branch
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Card>
                        )
                    }
                ]}
            />
        </div>
    );
};

export default PlotInterveneDetailPage;
