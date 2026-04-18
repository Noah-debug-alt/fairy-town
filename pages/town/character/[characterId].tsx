import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Layout,
    Card,
    Avatar,
    Button,
    Typography,
    Space,
    Tabs,
    Tag,
    List,
    Input,
    Divider,
    message,
    Popconfirm,
    Spin,
    Empty,
    Pagination,
    Select,
    DatePicker,
    Collapse,
} from 'antd';
import {
    ArrowLeftOutlined,
    UserOutlined,
    MessageOutlined,
    SendOutlined,
    DeleteOutlined,
    SyncOutlined,
    ReloadOutlined,
    ClockCircleOutlined,
    BookOutlined,
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;
const { RangePicker } = DatePicker;

interface CharacterRelationship {
    id: number;
    name: string;
    relation: string;
    description: string;
}

interface Memory {
    id: number;
    content: string;
    type: 'plot' | 'dialogue' | 'reflection' | 'observation';
    timestamp: string;
    importance: number;
}

interface ChatMessage {
    id: number;
    senderId: number;
    senderName: string;
    content: string;
    timestamp: string;
    isMe: boolean;
}

interface Character {
    id: number;
    name: string;
    avatarUrl: string | null;
    description: string;
    plotSetting: string;
    coreIdentity: string;
    classicLines: string[];
    relationships: CharacterRelationship[];
    isOnline: boolean;
    currentScene?: string;
}



const memoryTypeColors: Record<string, string> = {
    plot: '#1890ff',
    dialogue: '#52c41a',
    reflection: '#fa8c16',
    observation: '#13c2c2',
};

const memoryTypeLabels: Record<string, string> = {
    plot: '剧情',
    dialogue: '对话',
    reflection: '反思',
    observation: '观察',
};

const CharacterDetailPage: React.FC = () => {
    const { novelId, characterId } = useParams<{ novelId: string; characterId: string }>();
    const navigate = useNavigate();

    const [character, setCharacter] = useState<Character | null>(null);
    const [memories, setMemories] = useState<Memory[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('tab') || 'profile';
    });
    const [pageLoading, setPageLoading] = useState(false);
    const [memoriesLoading, setMemoriesLoading] = useState(false);
    const [memoryFilter, setMemoryFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(5);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (characterId) {
            const id = Number(characterId);
            console.log('角色详情页 - 获取角色ID:', id);
            setPageLoading(true);

            // 从 API 获取角色数据
            fetch(`/api/character/${id}`)
                .then(res => res.json())
                .then(result => {
                    console.log('角色API返回:', result);
                    if (result.code === 200 && result.data) {
                        let classicLines: string[] = [];
                        let relationships: CharacterRelationship[] = [];

                        try {
                            classicLines = result.data.classicLines ? JSON.parse(result.data.classicLines) : [];
                        } catch { }

                        try {
                            relationships = result.data.relationships ? JSON.parse(result.data.relationships) : [];
                        } catch { }

                        setCharacter({
                            id: result.data.id,
                            name: result.data.name,
                            avatarUrl: result.data.avatarUrl,
                            description: result.data.description,
                            plotSetting: result.data.plotSetting,
                            relationships: relationships,
                            coreIdentity: result.data.coreIdentity || '',
                            classicLines: classicLines,
                            isOnline: true,
                            currentScene: result.data.currentScene || '待分配'
                        });
                    } else {
                        console.log('角色不存在');
                        setCharacter(null);
                    }
                })
                .catch((err) => {
                    console.error('获取角色失败:', err);
                    setCharacter(null);
                })
                .finally(() => {
                    setPageLoading(false);
                });

            // 获取角色记忆
            fetch(`/api/character/${id}/memory?page=1&pageSize=20`)
                .then(res => res.json())
                .then(result => {
                    console.log('记忆API返回:', result);
                    if (result.code === 200 && result.data) {
                        setMemories(result.data.list || []);
                    }
                })
                .catch((err) => {
                    console.error('获取记忆失败:', err);
                });
        }
    }, [characterId]);

    // 加载聊天记录
    useEffect(() => {
        if (characterId && novelId) {
            const id = Number(characterId);
            const nid = Number(novelId);

            fetch(`/api/character/${id}/chat-history?novelId=${nid}`)
                .then(res => res.json())
                .then(result => {
                    if (result.code === 200 && result.data) {
                        setMessages(result.data);
                    }
                })
                .catch(err => {
                    console.error('获取聊天记录失败:', err);
                });
        }
    }, [characterId, novelId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!messageText.trim()) {
            message.warning('请输入消息');
            return;
        }

        setSending(true);
        const myMessage: ChatMessage = {
            id: Date.now(),
            senderId: 0,
            senderName: '我',
            content: messageText,
            timestamp: new Date().toISOString(),
            isMe: true,
        };

        setMessages(prev => [...prev, myMessage]);
        setMessageText('');

        try {
            const id = Number(characterId);
            console.log('发送聊天消息，角色ID:', id, '消息:', messageText);

            const history = messages.map(m => ({
                isMe: m.isMe,
                content: m.content
            }));

            const response = await fetch(`/api/character/${id}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageText,
                    history,
                    novelId: novelId ? Number(novelId) : 0
                })
            });

            console.log('聊天响应状态:', response.status);
            const data = await response.json();
            console.log('聊天响应数据:', data);

            if (data.code === 200) {
                const aiResponse: ChatMessage = {
                    id: Date.now() + 1,
                    senderId: character?.id || 1,
                    senderName: character?.name || '角色',
                    content: data.data.response,
                    timestamp: new Date().toISOString(),
                    isMe: false,
                };
                setMessages(prev => [...prev, aiResponse]);
                message.success('消息已发送');
            } else {
                message.error(data.message || '发送失败');
            }
        } catch (error) {
            console.error('发送消息失败:', error);
            message.error('发送失败，请重试');
        } finally {
            setSending(false);
        }
    };

    const handleClearMessages = () => {
        setMessages([]);
        message.success('对话记录已清空');
    };

    const handleTriggerReflection = () => {
        message.loading('正在触发反思，请稍候...', 2);
        setTimeout(() => {
            const newMemory: Memory = {
                id: Date.now(),
                content: `反思：与用户的对话让我思考了很多，关于${character?.name || '这个角色'}的成长和未来。`,
                type: 'reflection',
                timestamp: new Date().toISOString(),
                importance: 0.8,
            };
            setMemories(prev => [newMemory, ...prev]);
            message.success('反思已触发成功');
        }, 2000);
    };

    const handleResetMemory = () => {
        setMemories([]);
        message.success('角色记忆已重置');
    };

    const handleGoToCharacter = (targetCharacterId: number) => {
        navigate(`/town/${novelId}/character/${targetCharacterId}`);
    };

    const filteredMemories = memories.filter(m => {
        if (memoryFilter !== 'all' && m.type !== memoryFilter) return false;
        return true;
    });

    const paginatedMemories = filteredMemories.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const renderProfileTab = () => (
        <div style={{ padding: '0 24px' }}>
            <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                    <Avatar
                        src={character?.avatarUrl}
                        icon={<UserOutlined />}
                        size={120}
                        style={{ backgroundColor: '#667eea' }}
                    />
                    <div style={{ flex: 1 }}>
                        <Space align="center">
                            <Title level={3} style={{ margin: 0 }}>{character?.name}</Title>
                            <Tag color={character?.isOnline ? 'green' : 'default'}>
                                {character?.isOnline ? '在线' : '离线'}
                            </Tag>
                            <Tag color="blue">{character?.currentScene}</Tag>
                        </Space>
                        <div style={{ marginTop: 8 }}>
                            <Tag color="purple" style={{ fontSize: 14 }}>{character?.coreIdentity}</Tag>
                        </div>
                        <Paragraph style={{ marginTop: 12 }}>{character?.description}</Paragraph>
                    </div>
                </div>
            </Card>

            <Collapse defaultActiveKey={['1', '2', '3', '4']} ghost>
                <Panel header="完整人设描述" key="1">
                    <Card size="small">
                        <Paragraph style={{ margin: 0 }}>{character?.description}</Paragraph>
                    </Card>
                </Panel>
                <Panel header="核心剧情设定" key="2">
                    <Card size="small">
                        <Text>{character?.plotSetting}</Text>
                    </Card>
                </Panel>
                <Panel header="关系网" key="3">
                    <List
                        size="small"
                        dataSource={character?.relationships || []}
                        renderItem={item => (
                            <List.Item
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleGoToCharacter(item.id)}
                            >
                                <Space>
                                    <UserOutlined />
                                    <Text strong>{item.name}</Text>
                                    <Tag>{item.relation}</Tag>
                                    <Text type="secondary">{item.description}</Text>
                                </Space>
                            </List.Item>
                        )}
                    />
                </Panel>
                <Panel header="经典台词" key="4">
                    <List
                        size="small"
                        dataSource={character?.classicLines || []}
                        renderItem={line => (
                            <List.Item>
                                <Text italic>"{line}"</Text>
                            </List.Item>
                        )}
                    />
                </Panel>
            </Collapse>

            <Divider />

            <Space>
                <Button
                    type="primary"
                    icon={<MessageOutlined />}
                    onClick={() => setActiveTab('chat')}
                >
                    发起私聊
                </Button>
                <Button
                    icon={<SyncOutlined />}
                    onClick={handleTriggerReflection}
                >
                    手动触发反思
                </Button>
                <Popconfirm
                    title="确定要重置角色记忆吗？"
                    description="此操作将清空该角色的所有记忆，无法恢复"
                    onConfirm={handleResetMemory}
                    okText="确定"
                    cancelText="取消"
                >
                    <Button danger icon={<SyncOutlined />}>
                        重置角色记忆
                    </Button>
                </Popconfirm>
            </Space>
        </div>
    );

    const renderChatTab = () => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={styles.chatHeader}>
                <Space>
                    <Avatar
                        src={character?.avatarUrl}
                        icon={<UserOutlined />}
                        style={{ backgroundColor: '#667eea' }}
                    />
                    <div>
                        <Text strong style={{ fontSize: 16 }}>{character?.name}</Text>
                        <div>
                            <Tag color={character?.isOnline ? 'green' : 'default'} style={{ margin: 0 }}>
                                {character?.isOnline ? '在线' : '离线'}
                            </Tag>
                        </div>
                    </div>
                </Space>
                <Popconfirm
                    title="确定要清空对话记录吗？"
                    onConfirm={handleClearMessages}
                    okText="确定"
                    cancelText="取消"
                >
                    <Button danger icon={<DeleteOutlined />}>清空记录</Button>
                </Popconfirm>
            </div>

            <div style={styles.messageArea}>
                {messages.length === 0 ? (
                    <Empty description="暂无对话，开始聊天吧" />
                ) : (
                    messages.map(msg => (
                        <div
                            key={msg.id}
                            style={{
                                display: 'flex',
                                flexDirection: msg.isMe ? 'row-reverse' : 'row',
                                alignItems: 'flex-start',
                                marginBottom: 16,
                                padding: '0 16px',
                            }}
                        >
                            <Avatar
                                size="small"
                                icon={msg.isMe ? <UserOutlined /> : <UserOutlined />}
                                style={{
                                    backgroundColor: msg.isMe ? '#667eea' : '#52c41a',
                                    marginLeft: msg.isMe ? 12 : 0,
                                    marginRight: msg.isMe ? 0 : 12,
                                }}
                            />
                            <div style={{ maxWidth: '70%' }}>
                                <Space size={4} style={{ marginBottom: 4 }}>
                                    <Text strong style={{ fontSize: 12 }}>{msg.senderName}</Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                        {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </Space>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: msg.isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                                        backgroundColor: msg.isMe ? '#e6f7ff' : '#f5f5f5',
                                        color: msg.isMe ? '#333' : '#333',
                                    }}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div style={styles.inputArea}>
                <TextArea
                    placeholder="输入消息..."
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onPressEnter={e => {
                        if (!e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    style={styles.messageInput}
                />
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSendMessage}
                    loading={sending}
                    style={styles.sendButton}
                >
                    发送
                </Button>
            </div>
        </div>
    );

    const renderMemoryTab = () => (
        <div style={{ padding: '0 24px' }}>
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Select
                    value={memoryFilter}
                    onChange={setMemoryFilter}
                    style={{ width: 120 }}
                    options={[
                        { value: 'all', label: '全部' },
                        { value: 'plot', label: '剧情' },
                        { value: 'dialogue', label: '对话' },
                        { value: 'reflection', label: '反思' },
                        { value: 'observation', label: '观察' },
                    ]}
                />
                <RangePicker />
                <Button icon={<ReloadOutlined />} onClick={() => {
                    setMemoriesLoading(true);
                    const id = Number(characterId);
                    fetch(`/api/character/${id}/memory?page=1&pageSize=20`)
                        .then(res => res.json())
                        .then(result => {
                            if (result.code === 200 && result.data) {
                                setMemories(result.data.list || []);
                            }
                        })
                        .finally(() => {
                            setMemoriesLoading(false);
                            message.success('记忆已刷新');
                        });
                }}>
                    刷新
                </Button>
            </div>

            <Spin spinning={memoriesLoading}>
                {paginatedMemories.length === 0 ? (
                    <Empty description="暂无记忆" />
                ) : (
                    <List
                        dataSource={paginatedMemories}
                        renderItem={memory => (
                            <Card
                                size="small"
                                style={{
                                    marginBottom: 12,
                                    borderLeft: `4px solid ${memoryTypeColors[memory.type]}`,
                                }}
                            >
                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                    <Space>
                                        <Tag color={memoryTypeColors[memory.type]}>
                                            {memoryTypeLabels[memory.type]}
                                        </Tag>
                                        <Text type="secondary">
                                            <ClockCircleOutlined /> {new Date(memory.timestamp).toLocaleString('zh-CN')}
                                        </Text>
                                        <Text type="secondary">
                                            重要性: {memory.importance}/10
                                        </Text>
                                    </Space>
                                    <Text>{memory.content}</Text>
                                </Space>
                            </Card>
                        )}
                    />
                )}
            </Spin>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Pagination
                    current={currentPage}
                    pageSize={pageSize}
                    total={filteredMemories.length}
                    onChange={setCurrentPage}
                    showSizeChanger={false}
                />
            </div>
        </div>
    );

    const tabItems = [
        { key: 'profile', label: <span><UserOutlined />人设详情</span>, children: renderProfileTab() },
        { key: 'chat', label: <span><MessageOutlined />一对一私聊</span>, children: renderChatTab() },
        { key: 'memory', label: <span><BookOutlined />记忆流</span>, children: renderMemoryTab() },
    ];

    if (!character) {
        return (
            <Layout style={{ minHeight: '100vh', background: '#f0f5ff' }}>
                <Header style={styles.header}>
                    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/town/${novelId}`)} style={{ color: '#fff' }} />
                    <Title level={4} style={{ color: '#fff', margin: 0, marginLeft: 16 }}>加载中...</Title>
                </Header>
                <Content style={styles.content}><Spin size="large" spinning={pageLoading} /></Content>
            </Layout>
        );
    }

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f5ff' }}>
            <Header style={styles.header}>
                <Space>
                    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/town/${novelId}`)} style={{ color: '#fff' }} />
                    <Avatar src={character.avatarUrl} icon={<UserOutlined />} style={{ backgroundColor: '#667eea' }} />
                    <Title level={4} style={{ color: '#fff', margin: 0 }}>{character.name}</Title>
                </Space>
                <Tag color={character.isOnline ? 'green' : 'default'}>{character.isOnline ? '在线' : '离线'}</Tag>
            </Header>

            <Content style={styles.content}>
                <Card>
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={tabItems}
                        size="large"
                    />
                </Card>
            </Content>
        </Layout>
    );
};

const styles: Record<string, React.CSSProperties> = {
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        height: 60,
    },
    content: {
        padding: '24px',
        overflow: 'auto',
    },
    chatHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafbff',
    },
    messageArea: {
        flex: 1,
        overflow: 'auto',
        padding: '16px 0',
        background: 'linear-gradient(180deg, #fafbff 0%, #fff 100%)',
        maxHeight: 'calc(100vh - 380px)',
    },
    inputArea: {
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderTop: '1px solid #f0f0f0',
    },
    messageInput: {
        flex: 1,
        borderRadius: 8,
    },
    sendButton: {
        height: 40,
        borderRadius: 8,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
    },
};

export default CharacterDetailPage;
