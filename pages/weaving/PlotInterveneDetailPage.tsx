import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Button, Spin, message, Tabs, Input,
    List, Space, Tag, Divider, Radio
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

    // 手动编辑状态
    const [editedTitle, setEditedTitle] = useState('');
    const [editedNarration, setEditedNarration] = useState('');
    const [editedDialogues, setEditedDialogues] = useState<DialogueLine[]>([]);

    // AI改写状态
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiResult, setAiResult] = useState<DialogueLine[]>([]);
    const [aiGenerating, setAiGenerating] = useState(false);

    // 分支选择状态
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
                message.error('获取情节失败');
            }
        } catch {
            message.error('获取情节失败');
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
                message.success('情节更新成功');
                fetchPlot();
            } else {
                message.error(result.message || '更新失败');
            }
        } catch {
            message.error('更新失败');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateAiRewrite = async () => {
        if (!plot || !aiPrompt.trim()) {
            message.warning('请输入你的修改要求');
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
                message.success('AI改写生成成功');
            } else {
                message.error(result.message || 'AI改写失败');
            }
        } catch {
            message.error('AI改写失败');
        } finally {
            setAiGenerating(false);
        }
    };

    const handleAdoptAiResult = async () => {
        if (aiResult.length === 0) {
            message.warning('没有AI结果可以采用');
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
                message.success('AI结果已采用');
                setEditedDialogues(aiResult);
                setAiResult([]);
                setActiveTab('manual');
                fetchPlot();
            } else {
                message.error(result.message || '采用失败');
            }
        } catch {
            message.error('采用失败');
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
                message.success('分支生成成功');
            } else {
                message.error(result.message || '分支生成失败');
            }
        } catch {
            message.error('分支生成失败');
        } finally {
            setBranchGenerating(false);
        }
    };

    const handleSelectBranch = async () => {
        if (selectedBranch === null || !branches[selectedBranch]) {
            message.warning('请选择一个分支');
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
                message.success('分支已应用');
                setEditedDialogues(branch.dialogues);
                setBranches([]);
                setSelectedBranch(null);
                setActiveTab('manual');
                fetchPlot();
            } else {
                message.error(result.message || '应用失败');
            }
        } catch {
            message.error('应用失败');
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
                <Text>情节不存在</Text>
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
                    返回情节列表
                </Button>
            </div>

            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <Space>
                    <Tag color="blue">第{plot.chapterIndex}章 第{plot.sceneIndex}节</Tag>
                    <Tag color={plot.source === 'modified' ? 'orange' : 'green'}>
                        {plot.source === 'modified' ? '已修改' : '原小说'}
                    </Tag>
                </Space>
                <Title level={2} style={{ margin: '12px 0 0 0' }}>
                    <EditOutlined style={{ marginRight: 12 }} />
                    干预情节：{plot.title}
                </Title>
                <Text type="secondary">
                    修改此情节的内容、对话和行动
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
                                手动编辑
                            </span>
                        ),
                        children: (
                            <Card style={{ borderRadius: 12 }}>
                                <div style={{ marginBottom: 16 }}>
                                    <Text strong>标题：</Text>
                                    <Input
                                        value={editedTitle}
                                        onChange={(e) => setEditedTitle(e.target.value)}
                                        style={{ marginTop: 8 }}
                                    />
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                    <Text strong>旁白：</Text>
                                    <TextArea
                                        value={editedNarration}
                                        onChange={(e) => setEditedNarration(e.target.value)}
                                        rows={4}
                                        style={{ marginTop: 8 }}
                                    />
                                </div>

                                <Divider>对话内容</Divider>

                                <List
                                    dataSource={editedDialogues}
                                    renderItem={(dialogue, index) => (
                                        <Card
                                            size="small"
                                            style={{ marginBottom: 12, borderRadius: 8 }}
                                        >
                                            <Space style={{ width: '100%' }} direction="vertical">
                                                <Input
                                                    placeholder="说话者"
                                                    value={dialogue.speaker}
                                                    onChange={(e) => updateDialogue(index, 'speaker', e.target.value)}
                                                    style={{ width: 200 }}
                                                />
                                                <TextArea
                                                    placeholder="对话内容"
                                                    value={dialogue.content}
                                                    onChange={(e) => updateDialogue(index, 'content', e.target.value)}
                                                    rows={2}
                                                />
                                                <Input
                                                    placeholder="情绪（可选）"
                                                    value={dialogue.emotion || ''}
                                                    onChange={(e) => updateDialogue(index, 'emotion', e.target.value)}
                                                    style={{ width: 200 }}
                                                />
                                                <Button
                                                    danger
                                                    size="small"
                                                    onClick={() => removeDialogue(index)}
                                                >
                                                    删除
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
                                    + 添加对话
                                </Button>

                                <div style={{ textAlign: 'right' }}>
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        onClick={handleSaveManualEdit}
                                        loading={saving}
                                    >
                                        保存修改
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
                                AI改写
                            </span>
                        ),
                        children: (
                            <Card style={{ borderRadius: 12 }}>
                                <div style={{ marginBottom: 16 }}>
                                    <Text strong>描述你想要的修改：</Text>
                                    <TextArea
                                        placeholder="例如：让对话更加情感化，增加角色之间的紧张感..."
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
                                    生成AI改写
                                </Button>

                                {aiResult.length > 0 && (
                                    <>
                                        <Divider>AI生成结果</Divider>
                                        <div style={{
                                            background: '#f5f5f5',
                                            padding: 16,
                                            borderRadius: 8,
                                            marginBottom: 16
                                        }}>
                                            {aiResult.map((line, idx) => (
                                                <div key={idx} style={{ marginBottom: 8 }}>
                                                    <Text strong>{line.speaker}：</Text>
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
                                                采用此版本
                                            </Button>
                                            <Button onClick={() => setAiResult([])}>
                                                放弃
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
                                选择分支
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
                                    生成分支选项
                                </Button>

                                {branches.length > 0 && (
                                    <>
                                        <Divider>选择一个分支</Divider>
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
                                                                    {line.speaker}：{line.content}
                                                                </Text>
                                                            ))}
                                                            {branch.dialogues.length > 3 && (
                                                                <Text type="secondary">
                                                                    ... 还有 {branch.dialogues.length - 3} 行
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
                                                应用选中的分支
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
