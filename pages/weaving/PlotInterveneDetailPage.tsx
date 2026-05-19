import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Button, Tag, Spin, message,
    Input, Divider, Space, Tabs, Collapse, Row, Col
} from 'antd';
import {
    ArrowLeftOutlined, EditOutlined, BranchesOutlined,
    ThunderboltOutlined, SendOutlined, FileTextOutlined,
    EnvironmentOutlined, BookOutlined, RobotOutlined,
    FormOutlined, PlusOutlined, DeleteOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

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
}

interface Branch {
    label: string;
    description: string;
    dialogues: { speaker: string; content: string }[];
}

const PlotInterveneDetailPage: React.FC = () => {
    const { novelId, plotId } = useParams<{ novelId: string; plotId: string }>();
    const navigate = useNavigate();
    const [plot, setPlot] = useState<Plot | null>(null);
    const [loading, setLoading] = useState(false);
    const [rewritePrompt, setRewritePrompt] = useState('');
    const [rewriting, setRewriting] = useState(false);
    const [rewrittenDialogues, setRewrittenDialogues] = useState<{ speaker: string; content: string; emotion?: string }[]>([]);
    const [manualContent, setManualContent] = useState('');
    const [manualDialogues, setManualDialogues] = useState<{ speaker: string; content: string }[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [generatingBranches, setGeneratingBranches] = useState(false);
    const [applyingBranch, setApplyingBranch] = useState<number | null>(null);

    useEffect(() => {
        if (plotId) { fetchPlot(); }
    }, [plotId]);

    const fetchPlot = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/novel/${novelId}/plots`);
            const result = await response.json();
            if (result.code === 200) {
                const found = result.data.plots.find((p: Plot) => p.id === parseInt(plotId!));
                if (found) { setPlot(found); }
                else { message.error('情节未找到'); }
            }
        } catch { message.error('获取情节失败'); }
        finally { setLoading(false); }
    };

    const handleRewrite = async () => {
        if (!rewritePrompt.trim()) { message.warning('请输入改写要求'); return; }
        setRewriting(true);
        try {
            const response = await fetch(`/api/plot/${plotId}/rewrite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: rewritePrompt })
            });
            const result = await response.json();
            if (result.code === 200 && result.data.dialogues) {
                setRewrittenDialogues(result.data.dialogues);
                message.success('改写成功');
            } else {
                message.error(result.message || '改写失败');
            }
        } catch { message.error('改写失败'); }
        finally { setRewriting(false); }
    };

    const handleApplyRewrite = async () => {
        try {
            const response = await fetch(`/api/plot/${plotId}/apply-rewrite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dialogues: rewrittenDialogues })
            });
            const result = await response.json();
            if (result.code === 200) {
                message.success('应用成功');
                fetchPlot();
                setRewrittenDialogues([]);
                setRewritePrompt('');
            } else { message.error(result.message || '应用失败'); }
        } catch { message.error('应用失败'); }
    };

    const handleGenerateBranches = async () => {
        setGeneratingBranches(true);
        try {
            const response = await fetch(`/api/plot/${plotId}/branches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (result.code === 200 && result.data.branches) {
                setBranches(result.data.branches);
                message.success('分支生成成功');
            } else { message.error(result.message || '分支生成失败'); }
        } catch { message.error('分支生成失败'); }
        finally { setGeneratingBranches(false); }
    };

    const handleApplyBranch = async (index: number) => {
        setApplyingBranch(index);
        try {
            const response = await fetch(`/api/plot/${plotId}/apply-branch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branchIndex: index })
            });
            const result = await response.json();
            if (result.code === 200) {
                message.success('分支应用成功');
                fetchPlot();
            } else { message.error(result.message || '分支应用失败'); }
        } catch { message.error('分支应用失败'); }
        finally { setApplyingBranch(null); }
    };

    const handleManualSave = async () => {
        if (!manualContent.trim() && manualDialogues.length === 0) {
            message.warning('请输入修改内容');
            return;
        }
        try {
            const updateData: any = { source: 'modified' };
            if (manualContent.trim()) {
                updateData.narrationContent = manualContent;
                updateData.content = manualContent;
            }
            if (manualDialogues.length > 0) {
                // 修复：手动添加的对话需要转换为小镇模拟兼容的格式
                // 小镇模拟需要的格式是 "[标签] 角色名：'对话内容'"
                const dialogueContent = manualDialogues
                    .filter(d => d.speaker.trim() && d.content.trim())
                    .map(d => `[改编] ${d.speaker}：'${d.content}'`);
                updateData.dialogueContent = JSON.stringify(dialogueContent);
            }
            const response = await fetch(`/api/plot/${plotId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            const result = await response.json();
            if (result.code === 200) {
                message.success('手动修改已保存');
                fetchPlot();
                setManualContent('');
                setManualDialogues([]);
            } else { message.error(result.message || '保存失败'); }
        } catch { message.error('保存失败'); }
    };

    const addManualDialogue = () => {
        setManualDialogues([...manualDialogues, { speaker: '', content: '' }]);
    };

    const updateManualDialogue = (index: number, field: 'speaker' | 'content', value: string) => {
        const updated = [...manualDialogues];
        updated[index] = { ...updated[index], [field]: value };
        setManualDialogues(updated);
    };

    const removeManualDialogue = (index: number) => {
        setManualDialogues(manualDialogues.filter((_, i) => i !== index));
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

    if (!plot) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <Text type="secondary">情节未找到</Text>
                <br />
                <Button onClick={() => navigate(-1)} style={{ marginTop: 16 }}>返回</Button>
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
                <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate(-1)}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, marginBottom: 16 }}
                    >
                        返回情节列表
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
                            <Space>
                                <Tag style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8 }}>
                                    第{plot.chapterIndex}章 第{plot.sceneIndex}节
                                </Tag>
                            </Space>
                            <Title level={3} style={{ color: '#fff', margin: '4px 0 0 0' }}>{plot.title}</Title>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 900, margin: '-24px auto 0', padding: '0 24px 60px', position: 'relative', zIndex: 2 }}>
                {/* 原始情节卡片 */}
                <Card style={{
                    marginBottom: 20, borderRadius: 16, border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)',
                        padding: '14px 18px', marginBottom: 14,
                        borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 36, height: 36, borderRadius: 10,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        }}>
                            <FileTextOutlined style={{ fontSize: 18, color: '#fff' }} />
                        </div>
                        <Text strong style={{ fontSize: 15 }}>原始情节</Text>
                    </div>

                    {plot.location && (
                        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f8f9ff', borderRadius: 8, display: 'inline-block' }}>
                            <EnvironmentOutlined style={{ marginRight: 6, color: '#667eea' }} />
                            <Text style={{ fontSize: 13 }}>{plot.location}</Text>
                        </div>
                    )}

                    <div style={{
                        padding: 14, background: '#fafafa', borderRadius: 10,
                        borderLeft: '4px solid #667eea', marginBottom: 14
                    }}>
                        <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                            {plot.content || plot.narrationContent || '暂无内容'}
                        </Paragraph>
                    </div>

                    {parseDialogueContent(plot.dialogueContent).length > 0 && (
                        <Collapse ghost>
                            <Panel header={<Text type="secondary" style={{ fontSize: 13 }}><BookOutlined style={{ marginRight: 6 }} />查看原始对话</Text>} key="dialogue">
                                <div style={{ maxHeight: 250, overflow: 'auto' }}>
                                    {parseDialogueContent(plot.dialogueContent).map((line: string, idx: number) => (
                                        <div key={idx} style={{
                                            marginBottom: 6, padding: 8, background: '#f8f9ff',
                                            borderRadius: 8, borderLeft: '3px solid #667eea'
                                        }}>
                                            <Text style={{ fontSize: 13 }}>{line}</Text>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </Collapse>
                    )}
                </Card>

                {/* 干预操作区 */}
                <Card style={{
                    borderRadius: 16, border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
                }}>
                    <Tabs
                        defaultActiveKey="rewrite"
                        items={[
                            {
                                key: 'manual',
                                label: (
                                    <span>
                                        <FormOutlined style={{ marginRight: 6 }} />
                                        手动改写
                                    </span>
                                ),
                                children: (
                                    <div>
                                        <div style={{
                                            padding: 14, background: '#f6ffed', borderRadius: 10,
                                            marginBottom: 16, border: '1px solid #b7eb8f'
                                        }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>
                                                直接编辑情节的叙述内容和角色对话，修改后保存即可在小镇模拟中使用。
                                            </Text>
                                        </div>

                                        {/* 叙述内容编辑 */}
                                        <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                            <FileTextOutlined style={{ marginRight: 6, color: '#667eea' }} />
                                            叙述内容
                                        </Text>
                                        <TextArea
                                            rows={5}
                                            value={manualContent}
                                            onChange={e => setManualContent(e.target.value)}
                                            placeholder="输入修改后的场景叙述内容..."
                                            style={{ borderRadius: 10, marginBottom: 16, lineHeight: 1.8 }}
                                        />

                                        {/* 对话内容编辑 */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text strong>
                                                <BookOutlined style={{ marginRight: 6, color: '#667eea' }} />
                                                角色对话
                                            </Text>
                                            <Button
                                                size="small"
                                                icon={<PlusOutlined />}
                                                onClick={addManualDialogue}
                                                style={{ borderRadius: 8 }}
                                            >
                                                添加对话
                                            </Button>
                                        </div>

                                        {manualDialogues.length === 0 ? (
                                            <div style={{
                                                padding: 20, textAlign: 'center',
                                                background: '#fafafa', borderRadius: 10,
                                                marginBottom: 16, border: '1px dashed #d9d9d9'
                                            }}>
                                                <Text type="secondary" style={{ fontSize: 13 }}>
                                                    点击"添加对话"按钮添加角色对话
                                                </Text>
                                            </div>
                                        ) : (
                                            <div style={{ marginBottom: 16 }}>
                                                {manualDialogues.map((d, idx) => (
                                                    <div key={idx} style={{
                                                        display: 'flex', gap: 8, marginBottom: 8,
                                                        alignItems: 'flex-start'
                                                    }}>
                                                        <Input
                                                            placeholder="角色名"
                                                            value={d.speaker}
                                                            onChange={e => updateManualDialogue(idx, 'speaker', e.target.value)}
                                                            style={{ borderRadius: 8, width: 120, flexShrink: 0 }}
                                                        />
                                                        <Input
                                                            placeholder="对话内容"
                                                            value={d.content}
                                                            onChange={e => updateManualDialogue(idx, 'content', e.target.value)}
                                                            style={{ borderRadius: 8, flex: 1 }}
                                                        />
                                                        <Button
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => removeManualDialogue(idx)}
                                                            style={{ borderRadius: 8, flexShrink: 0 }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <Button
                                            type="primary"
                                            icon={<FormOutlined />}
                                            onClick={handleManualSave}
                                            block
                                            style={{
                                                borderRadius: 10, height: 44,
                                                background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                                                border: 'none'
                                            }}
                                        >
                                            保存修改
                                        </Button>
                                    </div>
                                )
                            },
                            {
                                key: 'rewrite',
                                label: (
                                    <span>
                                        <RobotOutlined style={{ marginRight: 6 }} />
                                        AI改写
                                    </span>
                                ),
                                children: (
                                    <div>
                                        <div style={{
                                            padding: 14, background: '#f8f9ff', borderRadius: 10,
                                            marginBottom: 16, border: '1px solid #e8ebff'
                                        }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>
                                                描述你想要的改写效果，AI将根据你的要求重新生成对话内容。
                                            </Text>
                                        </div>
                                        <TextArea
                                            rows={4}
                                            value={rewritePrompt}
                                            onChange={e => setRewritePrompt(e.target.value)}
                                            placeholder="例如：让角色A更加愤怒，让角色B试图安慰..."
                                            style={{ borderRadius: 10, marginBottom: 12 }}
                                        />
                                        <Button
                                            type="primary"
                                            icon={<SendOutlined />}
                                            onClick={handleRewrite}
                                            loading={rewriting}
                                            block
                                            style={{
                                                borderRadius: 10, height: 44,
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                border: 'none'
                                            }}
                                        >
                                            {rewriting ? '正在改写...' : '开始改写'}
                                        </Button>

                                        {rewrittenDialogues.length > 0 && (
                                            <div style={{ marginTop: 20 }}>
                                                <Divider style={{ fontSize: 14, color: '#667eea' }}>
                                                    <RobotOutlined style={{ marginRight: 6 }} />
                                                    改写结果
                                                </Divider>
                                                <div style={{ maxHeight: 300, overflow: 'auto', marginBottom: 16 }}>
                                                    {rewrittenDialogues.map((d, idx) => (
                                                        <div key={idx} style={{
                                                            marginBottom: 8, padding: 12, background: '#f8f9ff',
                                                            borderRadius: 10, borderLeft: '3px solid #667eea'
                                                        }}>
                                                            <Text strong style={{ color: '#667eea' }}>{d.speaker}</Text>
                                                            {d.emotion && <Tag color="blue" style={{ marginLeft: 8, borderRadius: 6, fontSize: 11 }}>{d.emotion}</Tag>}
                                                            <div style={{ marginTop: 4 }}>
                                                                <Text style={{ fontSize: 13 }}>{d.content}</Text>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <Button
                                                    type="primary"
                                                    icon={<ThunderboltOutlined />}
                                                    onClick={handleApplyRewrite}
                                                    block
                                                    style={{
                                                        borderRadius: 10, height: 44,
                                                        background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                                                        border: 'none'
                                                    }}
                                                >
                                                    应用改写
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )
                            },
                            {
                                key: 'branch',
                                label: (
                                    <span>
                                        <BranchesOutlined style={{ marginRight: 6 }} />
                                        生成分支
                                    </span>
                                ),
                                children: (
                                    <div>
                                        <div style={{
                                            padding: 14, background: '#fff7e6', borderRadius: 10,
                                            marginBottom: 16, border: '1px solid #ffe7ba'
                                        }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>
                                                AI将基于当前情节生成3个不同的发展分支，你可以选择一个应用。
                                            </Text>
                                        </div>
                                        <Button
                                            type="primary"
                                            icon={<BranchesOutlined />}
                                            onClick={handleGenerateBranches}
                                            loading={generatingBranches}
                                            block
                                            style={{
                                                borderRadius: 10, height: 44,
                                                background: 'linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)',
                                                border: 'none'
                                            }}
                                        >
                                            {generatingBranches ? '正在生成分支...' : '生成分支'}
                                        </Button>

                                        {branches.length > 0 && (
                                            <div style={{ marginTop: 20 }}>
                                                <Divider style={{ fontSize: 14, color: '#fa8c16' }}>
                                                    <BranchesOutlined style={{ marginRight: 6 }} />
                                                    分支选项
                                                </Divider>
                                                <Row gutter={[12, 12]}>
                                                    {branches.map((branch, idx) => {
                                                        const colors = [
                                                            { bg: '#f0f2ff', border: '#667eea', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
                                                            { bg: '#fff7e6', border: '#fa8c16', gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)' },
                                                            { bg: '#f6ffed', border: '#52c41a', gradient: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)' }
                                                        ];
                                                        const c = colors[idx % 3];
                                                        return (
                                                            <Col xs={24} sm={8} key={idx}>
                                                                <div style={{
                                                                    padding: 14, background: c.bg,
                                                                    borderRadius: 12, border: `1px solid ${c.border}30`,
                                                                    height: '100%', display: 'flex', flexDirection: 'column'
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                                        <span style={{
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            width: 24, height: 24, borderRadius: 6,
                                                                            background: c.gradient, color: '#fff', fontSize: 12, fontWeight: 'bold'
                                                                        }}>
                                                                            {String.fromCharCode(65 + idx)}
                                                                        </span>
                                                                        <Text strong style={{ fontSize: 13 }}>{branch.label}</Text>
                                                                    </div>
                                                                    <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 10, flex: 1 }}>
                                                                        {branch.description}
                                                                    </Paragraph>
                                                                    {branch.dialogues && branch.dialogues.length > 0 && (
                                                                        <div style={{ marginBottom: 10, maxHeight: 100, overflow: 'auto' }}>
                                                                            {branch.dialogues.slice(0, 2).map((d, di) => (
                                                                                <div key={di} style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
                                                                                    <Text strong style={{ fontSize: 11 }}>{d.speaker}:</Text> {d.content}
                                                                                </div>
                                                                            ))}
                                                                            {branch.dialogues.length > 2 && (
                                                                                <Text type="secondary" style={{ fontSize: 10 }}>...还有{branch.dialogues.length - 2}条对话</Text>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    <Button
                                                                        size="small"
                                                                        type="primary"
                                                                        onClick={() => handleApplyBranch(idx)}
                                                                        loading={applyingBranch === idx}
                                                                        block
                                                                        style={{ borderRadius: 8, background: c.gradient, border: 'none' }}
                                                                    >
                                                                        应用此分支
                                                                    </Button>
                                                                </div>
                                                            </Col>
                                                        );
                                                    })}
                                                </Row>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                        ]}
                    />
                </Card>
            </div>
        </div>
    );
};

export default PlotInterveneDetailPage;
