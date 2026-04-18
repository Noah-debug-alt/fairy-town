import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Layout,
    Card,
    Avatar,
    List,
    Button,
    Typography,
    Space,
    Tag,
    Timeline,
    Empty,
    message,
    Badge,
    Input,
    Switch,
    Checkbox,
    Modal,
    InputNumber,
    Spin,
    Skeleton,
    Divider,
} from 'antd';
import {
    ArrowLeftOutlined,
    UserOutlined,
    EnvironmentOutlined,
    ClockCircleOutlined,
    MessageOutlined,
    SendOutlined,
    TeamOutlined,
    PlusOutlined,
    PlayCircleOutlined,
    PauseCircleOutlined,
    CommentOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

interface Character {
    id: number;
    name: string;
    avatarUrl: string | null;
    description: string;
    plotSetting: string;
    currentScene?: string;
    isOnline?: boolean;
}

interface ChatMessage {
    id: number;
    senderId: number;
    senderName: string;
    senderAvatar?: string;
    content: string;
    timestamp: string;
    isMe?: boolean;
}

interface ChatSession {
    id: number;
    name: string;
    type?: string;
    participantIds: number[];
    participantNames: string[];
    lastMessage?: string;
    lastMessageTime?: string;
}

interface SceneEvent {
    id: number;
    characterId: number;
    characterName: string;
    type: 'message' | 'action' | 'location' | 'arrive' | 'leave';
    content: string;
    timestamp: string;
}

interface Scene {
    id: number;
    name: string;
    type: string;
    description: string;
    plotContext?: string;
    characters: Character[];
}

const defaultScenes: Record<number, Scene> = {
    1: {
        id: 1, name: '小镇广场', type: 'public',
        description: '小镇的中心广场，是居民们集合和交流的地方。广场中央有一座古老的喷泉，周围种满了美丽的花朵。每天傍晚，居民们都会在这里散步、聊天，享受悠闲的时光。',
        plotContext: '这里是小镇最热闹的地方，各种剧情事件常常在这里发生。角色们会在此交流信息、触发剧情。',
        characters: []
    },
    2: {
        id: 2, name: '幸福咖啡馆', type: 'shop',
        description: '温馨的咖啡馆，空气中弥漫着咖啡的香味。店内装饰着复古的家具和照片墙。',
        plotContext: '咖啡馆是小镇的信息集散地，人们喜欢在这里交换情报、结识新朋友。',
        characters: []
    },
    3: {
        id: 3, name: '星光公园', type: 'park',
        description: '绿树成荫的公园，夜晚湖面映照星光，因而得名。',
        plotContext: '浪漫的约会地点，也是思考人生的好地方。',
        characters: []
    },
    4: {
        id: 4, name: '童话小学', type: 'school',
        description: '孩子们学习的地方，老师用故事教导知识。',
        plotContext: '知识的殿堂，孩子们的成长之地。',
        characters: []
    },
    5: {
        id: 5, name: '爱心医院', type: 'hospital',
        description: '小镇的医院，设备齐全，医生专业。',
        plotContext: '救助生命的地方，也是获得帮助的场所。',
        characters: []
    },
    6: {
        id: 6, name: '魔法商店', type: 'shop',
        description: '售卖各种神奇物品的商店，充满魔法气息。',
        plotContext: '魔法物品的交易场所，有时会有奇遇发生。',
        characters: []
    },
    7: {
        id: 7, name: '温暖书店', type: 'shop',
        description: '安静的书店，有舒适的阅读角。',
        plotContext: '知识的海洋，智慧的源泉。',
        characters: []
    },
    8: {
        id: 8, name: '居民小屋', type: 'home',
        description: '小镇居民的住所，充满家庭温暖。',
        plotContext: '私人空间，角色们的日常起居之所。',
        characters: []
    },
};

const defaultCharacters: Character[] = [
    { id: 1, name: '小红帽', avatarUrl: null, description: '勇敢善良的小女孩', plotSetting: '去看望奶奶的路上', isOnline: true, currentScene: '星光公园' },
    { id: 2, name: '大灰狼', avatarUrl: null, description: '虽然凶猛但有时也很善良', plotSetting: '森林里的居民', isOnline: true, currentScene: '居民小屋' },
    { id: 3, name: '白雪公主', avatarUrl: null, description: '美丽善良的公主', plotSetting: '逃难到小镇', isOnline: true, currentScene: '居民小屋' },
    { id: 4, name: '七个小矮人', avatarUrl: null, description: '友善勤劳的小矮人', plotSetting: '矿工', isOnline: true, currentScene: '小镇广场' },
    { id: 5, name: '灰姑娘', avatarUrl: null, description: '勤劳善良的姑娘', plotSetting: '被继母虐待', isOnline: false, currentScene: '居民小屋' },
    { id: 6, name: '王子', avatarUrl: null, description: '英俊潇洒的王子', plotSetting: '寻找真爱', isOnline: true, currentScene: '幸福咖啡馆' },
];


const SceneDetailPage: React.FC = () => {
    const { novelId, sceneId } = useParams<{ novelId: string; sceneId: string }>();
    const navigate = useNavigate();

    const [scene, setScene] = useState<Scene | null>(null);
    const [sceneCharacters, setSceneCharacters] = useState<Character[]>([]);
    const [events] = useState<SceneEvent[]>([]);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sessionMessages, setSessionMessages] = useState<Record<number, ChatMessage[]>>({});
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    const [autoRunSteps, setAutoRunSteps] = useState(5);
    const [currentStep, setCurrentStep] = useState(0);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const autoRunTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const sceneTypeColors: Record<string, string> = {
        public: '#1890ff',
        shop: '#52c41a',
        park: '#13c2c2',
        school: '#722ed1',
        hospital: '#f5222d',
        home: '#fa8c16',
    };

    useEffect(() => {
        if (sceneId && novelId) {
            const id = Number(sceneId);
            setIsLoading(true);

            // 从 API 获取场景和角色数据
            fetch(`/api/town/${novelId}/data`)
                .then(res => res.json())
                .then(result => {
                    if (result.code === 200 && result.data) {
                        const data = result.data;
                        const scene = data.scenes?.find((s: any) => s.id === id) || { id, name: '未知场景', type: 'unknown', description: '' };
                        const chars = data.characters || [];

                        // 根据角色是否在当前场景来设置在线状态
                        const sceneName = scene.name;
                        const charsWithOnlineStatus = chars.map((c: any) => ({
                            ...c,
                            isOnline: c.currentScene === sceneName
                        }));

                        setScene({ ...scene, characters: charsWithOnlineStatus });
                        setSceneCharacters(charsWithOnlineStatus);
                    } else {
                        // 使用默认数据
                        const sceneData = defaultScenes[id] || { id, name: '未知场景', type: 'unknown', description: '未知的场景' };
                        const defaultCharsInScene = defaultCharacters.map(c => ({
                            ...c,
                            isOnline: c.currentScene === sceneData.name
                        }));
                        setScene(sceneData);
                        setSceneCharacters(defaultCharsInScene);
                    }
                })
                .catch(() => {
                    const sceneData = defaultScenes[id] || { id, name: '未知场景', type: 'unknown', description: '未知的场景' };
                    const defaultCharsInScene = defaultCharacters.map(c => ({
                        ...c,
                        isOnline: c.currentScene === sceneData.name
                    }));
                    setScene(sceneData);
                    setSceneCharacters(defaultCharsInScene);
                })
                .finally(() => {
                    setIsLoading(false);
                });

            // 获取场景的会话列表
            fetch(`/api/town/${novelId}/scene/${sceneId}/sessions`)
                .then(res => res.json())
                .then(result => {
                    if (result.code === 200 && result.data) {
                        const loadedSessions = result.data.map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            type: s.type,
                            participantIds: JSON.parse(s.participantIds || '[]'),
                            participantNames: [], // 这里可以根据ID填充
                            lastMessageTime: s.lastMessageTime
                        }));
                        setSessions(loadedSessions);
                        if (loadedSessions.length > 0 && !currentSession) {
                            setCurrentSession(loadedSessions[0]);
                        }
                    }
                })
                .catch(err => console.error('加载会话失败', err));
        }
    }, [sceneId, novelId]);

    // 当切换会话时加载消息
    useEffect(() => {
        if (currentSession && !sessionMessages[currentSession.id]) {
            fetch(`/api/session/${currentSession.id}/messages`)
                .then(res => res.json())
                .then(result => {
                    if (result.code === 200 && result.data) {
                        setSessionMessages(prev => ({
                            ...prev,
                            [currentSession.id]: result.data
                        }));
                    }
                })
                .catch(err => console.error('加载消息失败', err));
        }
    }, [currentSession]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (currentSession && sessionMessages[currentSession.id]) {
            setMessages(sessionMessages[currentSession.id]);
        } else if (currentSession) {
            setMessages([]);
        }
    }, [currentSession, sessionMessages]);

    const generateAutoMessage = useCallback(async () => {
        if (sceneCharacters.length === 0) return;
        if (!currentSession) return;

        const onlineChars = sceneCharacters.filter(c =>
            c.isOnline &&
            (currentSession.type === 'public' || currentSession.participantIds.includes(c.id))
        );
        if (onlineChars.length === 0) return;

        const randomChar = onlineChars[Math.floor(Math.random() * onlineChars.length)];
        const sceneName = scene?.name || '小镇';

        try {
            const response = await fetch('/api/scene/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterId: randomChar.id,
                    sceneName: sceneName,
                    context: sessionMessages[currentSession.id] || [],
                    sessionId: currentSession.id,
                    novelId: novelId
                })
            });

            const result = await response.json();

            const newMessage: ChatMessage = {
                id: Date.now(),
                senderId: randomChar.id,
                senderName: result.data?.characterName || randomChar.name,
                senderAvatar: randomChar.avatarUrl || undefined,
                content: result.data?.content || '...',
                timestamp: new Date().toISOString(),
            };

            setSessionMessages(prev => ({
                ...prev,
                [currentSession.id]: [...(prev[currentSession.id] || []), newMessage].slice(-99),
            }));
        } catch (error) {
            console.error('生成自动消息失败:', error);
            const fallbackMessage: ChatMessage = {
                id: Date.now(),
                senderId: randomChar.id,
                senderName: randomChar.name,
                senderAvatar: randomChar.avatarUrl || undefined,
                content: '...（思考中）',
                timestamp: new Date().toISOString(),
            };
            setSessionMessages(prev => ({
                ...prev,
                [currentSession.id]: [...(prev[currentSession.id] || []), fallbackMessage].slice(-99),
            }));
        }
        setCurrentStep(prev => prev + 1);
    }, [sceneCharacters, currentSession, scene, sessionMessages]);

    useEffect(() => {
        if (isAutoRunning && currentStep < autoRunSteps) {
            autoRunTimerRef.current = setInterval(() => {
                generateAutoMessage();
            }, 2000);
        } else if (!isAutoRunning || currentStep >= autoRunSteps) {
            if (autoRunTimerRef.current) {
                clearInterval(autoRunTimerRef.current);
                autoRunTimerRef.current = null;
            }
            if (currentStep >= autoRunSteps) {
                setIsAutoRunning(false);
                message.info('已达到设置的运行步数');
            }
        }
        return () => {
            if (autoRunTimerRef.current) {
                clearInterval(autoRunTimerRef.current);
            }
        };
    }, [isAutoRunning, currentStep, autoRunSteps, generateAutoMessage]);

    const handleSendMessage = async () => {
        if (!messageText.trim()) {
            message.warning('请输入消息');
            return;
        }

        if (!currentSession) {
            message.warning('请先选择一个会话');
            return;
        }

        setLoading(true);
        const myMessage: ChatMessage = {
            id: Date.now(),
            senderId: 0,
            senderName: '我',
            content: messageText,
            timestamp: new Date().toISOString(),
            isMe: true,
        };

        if (currentSession) {
            setSessionMessages(prev => ({
                ...prev,
                [currentSession.id]: [...(prev[currentSession.id] || []), myMessage].slice(-99),
            }));
        }
        setMessageText('');

        setTimeout(async () => {
            if (sceneCharacters.length > 0) {
                const otherChars = sceneCharacters.filter(c =>
                    c.id !== 0 &&
                    (currentSession.type === 'public' || currentSession.participantIds.includes(c.id))
                );
                if (otherChars.length === 0) return;

                const randomChar = otherChars[Math.floor(Math.random() * otherChars.length)];
                const sceneName = scene?.name || '小镇';
                const currentMessages = sessionMessages[currentSession.id] || [];

                try {
                    const response = await fetch('/api/scene/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            characterId: randomChar.id,
                            sceneName: sceneName,
                            context: currentMessages,
                            sessionId: currentSession.id,
                            novelId: novelId,
                            userMessage: messageText
                        })
                    });

                    const result = await response.json();
                    const aiResponse: ChatMessage = {
                        id: Date.now() + 1,
                        senderId: randomChar.id,
                        senderName: result.data?.characterName || randomChar.name,
                        senderAvatar: randomChar.avatarUrl || undefined,
                        content: result.data?.content || '收到！',
                        timestamp: new Date().toISOString(),
                    };
                    if (currentSession) {
                        setSessionMessages(prev => ({
                            ...prev,
                            [currentSession.id]: [...(prev[currentSession.id] || []), aiResponse].slice(-99),
                        }));
                    }
                } catch (error) {
                    console.error('生成角色回复失败:', error);
                }
            }
            message.success('消息已发送');
            setLoading(false);
        }, 1000);
    };

    const handleCreateGroup = async () => {
        if (selectedCharacters.length < 2) {
            message.warning('请至少选择2个角色');
            return;
        }

        try {
            const response = await fetch(`/api/town/${novelId}/scene/${sceneId}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `群聊 ${sessions.length + 1}`,
                    participantIds: selectedCharacters
                })
            });
            const result = await response.json();

            if (result.code === 200 && result.data) {
                const s = result.data;
                const newSession: ChatSession = {
                    id: s.id,
                    name: s.name,
                    participantIds: JSON.parse(s.participantIds || '[]'),
                    participantNames: sceneCharacters.filter(c => selectedCharacters.includes(c.id)).map(c => c.name),
                    lastMessageTime: s.lastMessageTime,
                };

                setSessions(prev => [newSession, ...prev]);
                setCurrentSession(newSession);
                setSessionMessages(prev => ({
                    ...prev,
                    [newSession.id]: [],
                }));
                setSelectedCharacters([]);
                setCreateModalVisible(false);
                message.success('群聊创建成功');
            } else {
                message.error('创建群聊失败: ' + result.message);
            }
        } catch (error) {
            console.error('创建群聊失败', error);
            message.error('创建群聊请求失败');
        }
    };

    const handlePrivateChat = (character: Character) => {
        console.log('场景页点击私聊 - 角色ID:', character.id, '角色名:', character.name);
        navigate(`/town/${novelId}/character/${character.id}?tab=chat`);
    };

    const handleAutoRunToggle = (checked: boolean) => {
        if (checked) {
            setCurrentStep(0);
            setIsAutoRunning(true);
            message.success('群聊自主运行已开启');
        } else {
            setIsAutoRunning(false);
            message.info('群聊自主运行已停止');
        }
    };

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'message': return <MessageOutlined style={{ color: '#1890ff' }} />;
            case 'arrive': return <ArrowLeftOutlined style={{ color: '#52c41a' }} />;
            case 'leave': return <EnvironmentOutlined style={{ color: '#f5222d' }} />;
            default: return <UserOutlined style={{ color: '#fa8c16' }} />;
        }
    };

    const getEventColor = (type: string) => {
        switch (type) {
            case 'message': return '#1890ff';
            case 'arrive': return '#52c41a';
            case 'leave': return '#f5222d';
            default: return '#fa8c16';
        }
    };

    const renderMessage = (msg: ChatMessage) => {
        const isMe = msg.senderId === 0;
        return (
            <div
                key={msg.id}
                style={{
                    display: 'flex',
                    flexDirection: isMe ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    marginBottom: 16,
                    padding: '0 16px',
                }}
            >
                <Avatar
                    src={msg.senderAvatar}
                    icon={!msg.senderAvatar && <UserOutlined />}
                    style={{
                        backgroundColor: isMe ? '#667eea' : '#52c41a',
                        marginLeft: isMe ? 12 : 0,
                        marginRight: isMe ? 0 : 12,
                    }}
                />
                <div style={{ maxWidth: '70%' }}>
                    <Space size={4} style={{ marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 12, color: isMe ? '#667eea' : '#333' }}>
                            {msg.senderName}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </Space>
                    <div
                        style={{
                            padding: '10px 14px',
                            borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                            backgroundColor: isMe ? 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)' : '#f5f5f5',
                            color: '#333',
                            wordBreak: 'break-word',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                    >
                        {msg.content}
                    </div>
                </div>
            </div>
        );
    };

    if (!scene) {
        return (
            <Layout style={{ minHeight: '100vh', background: '#f0f5ff' }}>
                <Header style={styles.header}>
                    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/town/${novelId}`)} style={{ color: '#fff' }} />
                    <Title level={4} style={{ color: '#fff', margin: 0, marginLeft: 16 }}>加载中...</Title>
                </Header>
                <Content style={styles.content}><Spin size="large" /></Content>
            </Layout>
        );
    }

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f5ff' }}>
            <Header style={styles.header}>
                <Space>
                    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/town/${novelId}`)} style={{ color: '#fff' }} />
                    <Title level={4} style={{ color: '#fff', margin: 0 }}>{scene.name}</Title>
                    <Tag color={sceneTypeColors[scene.type]}>{scene.type}</Tag>
                </Space>
                <Space>
                    <Badge count={sceneCharacters.length} style={{ backgroundColor: '#52c41a' }}>
                        <UserOutlined style={{ color: '#fff', fontSize: 18 }} />
                    </Badge>
                    <Text style={{ color: '#fff' }}>{sceneCharacters.length}人在场</Text>
                </Space>
            </Header>

            <Layout>
                <Sider width={280} style={styles.sider}>
                    <div style={styles.siderHeader}>
                        <Title level={5} style={{ margin: 0, color: '#667eea' }}><Space><TeamOutlined />场景角色</Space></Title>
                    </div>
                    <div style={styles.characterList}>
                        {isLoading ? (
                            <Skeleton avatar active paragraph={{ rows: 3 }} />
                        ) : sceneCharacters.length === 0 ? (
                            <Empty description="暂无角色" />
                        ) : (
                            <List
                                dataSource={sceneCharacters}
                                renderItem={character => (
                                    <List.Item style={styles.characterItem}>
                                        <List.Item.Meta
                                            avatar={
                                                <Badge dot status={character.isOnline ? 'success' : 'default'} offset={[-5, 35]}>
                                                    <Avatar src={character.avatarUrl} icon={<UserOutlined />} style={{ backgroundColor: character.isOnline ? '#52c41a' : '#999' }} />
                                                </Badge>
                                            }
                                            title={<Text strong>{character.name}</Text>}
                                            description={
                                                <Space direction="vertical" size={0}>
                                                    <Text type="secondary" style={{ fontSize: 12 }}>{character.description}</Text>
                                                    <Tag color={character.isOnline ? 'green' : 'default'} style={{ marginTop: 4 }}>{character.isOnline ? '在线' : '离线'}</Tag>
                                                </Space>
                                            }
                                        />
                                        <Button type="link" size="small" icon={<MessageOutlined />} onClick={() => handlePrivateChat(character)}>私聊</Button>
                                    </List.Item>
                                )}
                            />
                        )}
                    </div>
                </Sider>

                <Content style={styles.chatContent}>
                    <div style={styles.sessionBar}>
                        <Space wrap>
                            {sessions.map(session => (
                                <Tag
                                    key={session.id}
                                    color={currentSession?.id === session.id ? '#667eea' : 'default'}
                                    style={{ cursor: 'pointer', padding: '4px 12px' }}
                                    onClick={() => setCurrentSession(session)}
                                >
                                    <CommentOutlined /> {session.name}
                                </Tag>
                            ))}
                            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>创建群聊</Button>
                        </Space>
                    </div>

                    <div style={styles.messageArea}>
                        {messages.length === 0 ? (
                            <Empty description="暂无消息，开始聊天吧" />
                        ) : (
                            messages.map((msg) => renderMessage(msg))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div style={styles.inputArea}>
                        <div style={styles.controlRow}>
                            <Space>
                                <Text>自主运行:</Text>
                                <Switch checked={isAutoRunning} onChange={handleAutoRunToggle} checkedChildren={<PlayCircleOutlined />} unCheckedChildren={<PauseCircleOutlined />} />
                                <Text>步数:</Text>
                                <InputNumber min={1} max={50} value={autoRunSteps} onChange={v => setAutoRunSteps(v || 5)} style={{ width: 70 }} size="small" />
                                {isAutoRunning && <Text type="secondary">已运行: {currentStep}/{autoRunSteps}</Text>}
                            </Space>
                        </div>
                        <div style={styles.inputRow}>
                            <TextArea
                                placeholder="输入消息..."
                                value={messageText}
                                onChange={e => setMessageText(e.target.value)}
                                onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                autoSize={{ minRows: 1, maxRows: 3 }}
                                style={styles.messageInput}
                            />
                            <Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage} loading={loading} style={styles.sendButton}>发送</Button>
                        </div>
                    </div>
                </Content>

                <Sider width={300} style={styles.sider}>
                    <div style={styles.siderHeader}>
                        <Title level={5} style={{ margin: 0, color: '#667eea' }}><Space><EnvironmentOutlined />场景信息</Space></Title>
                    </div>
                    <div style={{ padding: 16, overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                        <Card size="small" title="场景描述" style={{ marginBottom: 16 }}>
                            <Paragraph ellipsis={{ rows: 4 }}>{scene.description}</Paragraph>
                        </Card>
                        <Card size="small" title="剧情上下文" style={{ marginBottom: 16 }}>
                            <Paragraph ellipsis={{ rows: 4 }}>{scene.plotContext || '暂无剧情上下文'}</Paragraph>
                        </Card>
                        <Divider><Space><ClockCircleOutlined />历史记录</Space></Divider>
                        <Timeline
                            items={events.map(event => ({
                                dot: getEventIcon(event.type),
                                color: getEventColor(event.type),
                                children: (
                                    <div>
                                        <Text strong>{event.characterName}</Text>
                                        <Text type="secondary"> {event.type === 'message' ? '说' : event.type === 'action' ? '做' : event.type === 'arrive' ? '到达' : '离开'}</Text>
                                        <div><Text>{event.content}</Text></div>
                                        <Text type="secondary" style={{ fontSize: 11 }}>{new Date(event.timestamp).toLocaleString('zh-CN')}</Text>
                                    </div>
                                ),
                            }))}
                        />
                    </div>
                </Sider>
            </Layout>

            <Modal
                title="创建群聊"
                open={createModalVisible}
                onOk={handleCreateGroup}
                onCancel={() => { setCreateModalVisible(false); setSelectedCharacters([]); }}
                okText="创建"
            >
                <p>选择参与群聊的角色（至少2人）：</p>
                <Checkbox.Group value={selectedCharacters} onChange={v => setSelectedCharacters(v as number[])}>
                    <Space direction="vertical">
                        {sceneCharacters.map(c => (
                            <Checkbox key={c.id} value={c.id}>
                                <Space>
                                    <Avatar src={c.avatarUrl} icon={<UserOutlined />} size="small" />
                                    {c.name}
                                </Space>
                            </Checkbox>
                        ))}
                    </Space>
                </Checkbox.Group>
            </Modal>
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
    sider: {
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
    },
    siderHeader: {
        padding: '12px 16px',
        borderBottom: '2px solid #f0f5ff',
        background: '#fafbff',
    },
    characterList: {
        padding: '8px',
        overflow: 'auto',
        maxHeight: 'calc(100vh - 180px)',
    },
    characterItem: {
        padding: '12px !important',
        borderRadius: 8,
        marginBottom: 8,
        background: '#fafbff',
        border: '1px solid #f0f5ff',
    },
    chatContent: {
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
    },
    sessionBar: {
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafbff',
    },
    messageArea: {
        flex: 1,
        overflow: 'auto',
        padding: '16px 0',
        background: 'linear-gradient(180deg, #fafbff 0%, #fff 100%)',
    },
    inputArea: {
        padding: '12px 16px',
        borderTop: '1px solid #f0f0f0',
        background: '#fff',
    },
    controlRow: {
        marginBottom: 8,
    },
    inputRow: {
        display: 'flex',
        gap: 12,
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

export default SceneDetailPage;
