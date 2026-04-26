import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    Layout, Avatar, List, Input, Button, Switch, Slider,
    Badge, Typography, Space, Drawer, Descriptions, Tag, Empty,
    message, Spin, Tooltip, Progress,
} from 'antd';
import {
    ArrowLeftOutlined, SendOutlined, ReloadOutlined, BellOutlined,
    SearchOutlined, UserOutlined, EnvironmentOutlined,
    MessageOutlined, PlayCircleOutlined, PauseCircleOutlined,
    SmileOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
    CameraOutlined, EditOutlined, UndoOutlined,
} from '@ant-design/icons';
import TownMap from '../../components/TownMap';
import type { MapScene, MapCharacter, MapEvent } from '../../components/TownMap';

const { Header, Sider, Content, Footer } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;

interface Novel {
    id: number;
    title: string;
    author: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const TownVisualizationPage: React.FC = () => {
    const { novelId } = useParams<{ novelId: string }>();
    const navigate = useNavigate();

    const [novel, setNovel] = useState<Novel | null>(null);
    const [characters, setCharacters] = useState<MapCharacter[]>([]);
    const [scenes, setScenes] = useState<MapScene[]>([]);
    const [events, setEvents] = useState<MapEvent[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [searchText, setSearchText] = useState('');
    const [selectedCharacter, setSelectedCharacter] = useState<MapCharacter | null>(null);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [commandText, setCommandText] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatingImages, setGeneratingImages] = useState(false);

    const [leftSiderCollapsed, setLeftSiderCollapsed] = useState(false);
    const [rightSiderCollapsed, setRightSiderCollapsed] = useState(false);
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const isMobile = screenWidth < 768;

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const { isLoading, mutate } = useSWR(
        novelId ? `/api/town/${novelId}/map-data` : null,
        fetcher,
        {
            refreshInterval: isRunning ? 3000 / speed : 5000,
            onSuccess: (data) => {
                if (data?.data) {
                    setNovel(data.data.novel);
                    setCharacters(data.data.characters || []);
                    setScenes(data.data.scenes || []);
                    if (!isRunning) {
                        setEvents(data.data.events || []);
                    }
                }
            }
        }
    );

    useSWR(
        novelId && isRunning ? `/api/town/${novelId}/events` : null,
        fetcher,
        {
            refreshInterval: isRunning ? 3000 / speed : 0,
            onSuccess: (data) => {
                if (data?.data) {
                    setEvents(data.data);
                }
            }
        }
    );

    const filteredCharacters = characters.filter(c =>
        c.name.toLowerCase().includes(searchText.toLowerCase())
    );

    const handleRunningChange = async (checked: boolean) => {
        setIsRunning(checked);
        try {
            await fetch(`/api/town/${novelId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isRunning: checked, speed })
            });
        } catch (error) {
            console.error('切换运行状态失败:', error);
            setIsRunning(!checked);
        }
    };

    const handleSpeedChange = async (value: number) => {
        setSpeed(value);
        if (isRunning) {
            try {
                await fetch(`/api/town/${novelId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isRunning: true, speed: value })
                });
            } catch (error) {
                console.error('更新速度失败:', error);
            }
        }
    };

    const handleCharacterClick = (character: MapCharacter) => {
        setSelectedCharacter(character);
        setDrawerVisible(true);
    };

    const handleSceneClick = (sceneId: number) => {
        navigate(`/town/${novelId}/scene/${sceneId}`);
    };

    const handleSendCommand = async () => {
        if (!commandText.trim()) return;
        setLoading(true);
        try {
            await fetch(`/api/town/${novelId}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: commandText })
            });
            setCommandText('');
            message.success('指令已发送');
        } catch {
            message.error('发送失败');
        }
        setLoading(false);
    };

    const handleGenerateImages = async () => {
        if (!novelId) return;
        setGeneratingImages(true);
        try {
            const res = await fetch('/api/image-gen/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ novelId: parseInt(novelId) })
            });
            const data = await res.json();
            if (data.code === 200) {
                message.success('图片生成完成！');
                mutate();
            } else {
                message.error(data.message || '图片生成失败');
            }
        } catch (err: any) {
            message.error('图片生成失败: ' + err.message);
        }
        setGeneratingImages(false);
    };

    const handleClearEvents = () => {
        setEvents([]);
    };

    const handleResetProgress = async () => {
        try {
            const response = await fetch(`/api/town/${novelId}/reset-progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plotIndex: 0, resetCompleted: true })
            });
            const result = await response.json();
            if (result.code === 200) {
                message.success('进度已重置，请重新启动模拟');
                mutate();
            } else {
                message.error(result.message || '重置失败');
            }
        } catch (error) {
            message.error('重置失败');
        }
    };

    const handleGoToWeaving = () => {
        navigate(`/weaving/${novelId}/intervene`);
    };

    const renderEventContent = (content: string) => {
        const parts = content.split('\n');
        if (parts.length > 1 && parts[0].startsWith('【') && parts[0].endsWith('】')) {
            const tag = parts[0].slice(1, -1);
            let tagColor = 'default';
            if (tag === '完全按照情节') tagColor = 'green';
            else if (tag === '改编') tagColor = 'blue';
            else if (tag === '补充') tagColor = 'orange';
            else if (tag === '动作') tagColor = 'cyan';
            else if (tag === '音效') tagColor = 'gold';
            else if (tag.startsWith('场景')) tagColor = 'purple';
            else if (tag === '舞台动作/场景说明') tagColor = 'cyan';
            else if (tag === '旁白') tagColor = 'magenta';
            else if (tag === '幕落') tagColor = 'volcano';

            return (
                <div>
                    <Tag color={tagColor} style={{ marginBottom: 4 }}>{tag}</Tag>
                    <Text style={{ display: 'block' }}>{parts.slice(1).join('\n')}</Text>
                </div>
            );
        }
        return <Text>{content}</Text>;
    };

    const plotProgress = (() => {
        if (events.length === 0) return null;
        const plotStarts = events.filter(e => e.type === 'plot_start').length;
        const plotCompletes = events.filter(e => e.type === 'plot_complete').length;
        return { completed: plotCompletes, total: plotStarts || plotCompletes };
    })();

    const renderDesktopLayout = () => (
        <Layout style={{ flex: 1, overflow: 'hidden', width: '100%' }}>
            <Sider
                width={280}
                collapsedWidth={0}
                collapsible
                collapsed={leftSiderCollapsed}
                onCollapse={(collapsed) => setLeftSiderCollapsed(collapsed)}
                trigger={null}
                style={{
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                    overflow: 'hidden',
                    transition: 'all 0.3s',
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '2px solid #f0f5ff',
                    background: '#fafbff',
                }}>
                    <Title level={5} style={{ margin: 0, color: '#667eea' }}>
                        <Space><UserOutlined />角色列表</Space>
                    </Title>
                    <Spin size="small" spinning={isLoading} />
                </div>
                <Input
                    placeholder="搜索角色..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    style={{ margin: '12px 16px', borderRadius: 8 }}
                />
                <div style={{ padding: '0 8px', overflow: 'auto', height: 'calc(100% - 120px)' }}>
                    <List
                        dataSource={filteredCharacters}
                        renderItem={character => (
                            <List.Item
                                style={{
                                    cursor: 'pointer', borderRadius: 12, marginBottom: 8, transition: 'all 0.3s',
                                    padding: '12px', background: '#fafbff', border: '1px solid #f0f5ff',
                                }}
                                onClick={() => handleCharacterClick(character)}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <Badge dot status={character.isOnline ? 'success' : 'default'} offset={[-5, 35]}>
                                            <Avatar
                                                src={character.imageUrl || character.avatarUrl}
                                                icon={!character.imageUrl && !character.avatarUrl && <UserOutlined />}
                                                style={{ backgroundColor: character.isOnline ? '#52c41a' : '#999', border: '2px solid #fff' }}
                                            />
                                        </Badge>
                                    }
                                    title={<Text strong>{character.name}</Text>}
                                    description={
                                        <Space direction="vertical" size={0}>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                <EnvironmentOutlined /> {character.currentScene || '待分配'}
                                            </Text>
                                        </Space>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </div>
            </Sider>

            <Content style={{
                padding: 0,
                background: '#f0f5ff',
                overflow: 'hidden',
                flex: 1,
                width: '100%',
                position: 'relative',
            }}>
                <TownMap
                    scenes={scenes}
                    characters={characters}
                    events={events}
                    onSceneClick={handleSceneClick}
                    onCharacterClick={handleCharacterClick}
                    isRunning={isRunning}
                    speed={speed}
                />
            </Content>

            <Sider
                width={320}
                collapsedWidth={0}
                collapsible
                collapsed={rightSiderCollapsed}
                onCollapse={(collapsed) => setRightSiderCollapsed(collapsed)}
                trigger={null}
                style={{
                    background: '#fff',
                    borderLeft: '1px solid #f0f0f0',
                    overflow: 'hidden',
                    transition: 'all 0.3s',
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '2px solid #f0f5ff',
                    background: '#fafbff',
                }}>
                    <Title level={5} style={{ margin: 0, color: '#667eea' }}>
                        <Space><MessageOutlined />小镇实时动态</Space>
                    </Title>
                    <Button type="text" size="small" onClick={handleClearEvents}>清空</Button>
                </div>
                {plotProgress && (
                    <div style={{ padding: '8px 16px', background: '#fafbff' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>情节进度</Text>
                        <Progress
                            percent={plotProgress.total > 0 ? Math.round(plotProgress.completed / plotProgress.total * 100) : 0}
                            size="small"
                            strokeColor="#667eea"
                            format={() => `${plotProgress.completed}/${plotProgress.total}`}
                        />
                    </div>
                )}
                <div style={{ padding: '0 12px', overflow: 'auto', height: `calc(100% - ${plotProgress ? 120 : 60}px)` }}>
                    {events.length === 0 ? (
                        <Empty description="暂无动态" style={{ marginTop: 40 }} />
                    ) : (
                        events.map(event => (
                            <div
                                key={event.id}
                                style={{
                                    display: 'flex', gap: 12, padding: 12, borderRadius: 12, marginBottom: 8,
                                    border: '1px solid #f0f5ff',
                                    backgroundColor: event.isRead ? 'rgba(255,255,255,0.8)' : '#f0f5ff',
                                    borderLeft: event.isRead ? '3px solid #d9d9d9' : '3px solid #1890ff',
                                }}
                            >
                                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#52c41a', border: '2px solid #fff', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text strong>{event.characterName || '系统'}</Text>
                                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                                        {event.type === 'message' || event.type === 'dialogue' ? '说' : event.type === 'action' ? '做' : event.type === 'narration' ? '音效/旁白' : event.type === 'plot_start' ? '场景' : event.type === 'plot_complete' ? '系统' : '在'}
                                    </Text>
                                    {renderEventContent(event.content)}
                                    <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                                        {new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </Text>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Sider>
        </Layout>
    );

    const renderMobileLayout = () => (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f5ff', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative' }}>
                <TownMap
                    scenes={scenes}
                    characters={characters}
                    events={events}
                    onSceneClick={handleSceneClick}
                    onCharacterClick={handleCharacterClick}
                    isRunning={isRunning}
                    speed={speed}
                />
            </div>
        </div>
    );

    return (
        <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Header style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 24px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                height: 64,
                flexShrink: 0,
            }}>
                <Space>
                    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/novel-management')} style={{ color: '#fff' }} />
                    <SmileOutlined style={{ fontSize: 24, color: '#ffd700' }} />
                    <Title level={4} style={{ color: '#fff', margin: 0 }}>{novel?.title || '童话镇'}</Title>
                    {!isMobile && (
                        <Button
                            type="text"
                            icon={leftSiderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setLeftSiderCollapsed(!leftSiderCollapsed)}
                            style={{ color: '#fff', marginLeft: 16 }}
                            title={leftSiderCollapsed ? '展开角色列表' : '收起角色列表'}
                        />
                    )}
                </Space>
                <Space size="large">
                    <Space>
                        <span style={{ color: '#fff' }}>运行:</span>
                        <Switch
                            checked={isRunning}
                            onChange={handleRunningChange}
                            checkedChildren={<PlayCircleOutlined />}
                            unCheckedChildren={<PauseCircleOutlined />}
                        />
                    </Space>
                    {!isMobile && (
                        <Space>
                            <span style={{ color: '#fff' }}>速度:</span>
                            <Slider min={1} max={5} value={speed} onChange={handleSpeedChange} style={{ width: 80 }} />
                        </Space>
                    )}
                    <Tooltip title="生成场景与角色图片">
                        <Button
                            type="text"
                            icon={<CameraOutlined />}
                            onClick={handleGenerateImages}
                            loading={generatingImages}
                            style={{ color: '#fff' }}
                        />
                    </Tooltip>
                    <Tooltip title="情节编织坊">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={handleGoToWeaving}
                            style={{ color: '#fff' }}
                        />
                    </Tooltip>
                    <Tooltip title="重置进度">
                        <Button
                            type="text"
                            icon={<UndoOutlined />}
                            onClick={handleResetProgress}
                            style={{ color: '#fff' }}
                        />
                    </Tooltip>
                    <Badge count={events.filter(e => !e.isRead).length}>
                        <Button type="text" icon={<BellOutlined />} style={{ color: '#fff' }} />
                    </Badge>
                    <Button type="text" icon={<ReloadOutlined />} onClick={() => mutate()} style={{ color: '#fff' }} />
                    {!isMobile && (
                        <Button
                            type="text"
                            icon={rightSiderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setRightSiderCollapsed(!rightSiderCollapsed)}
                            style={{ color: '#fff' }}
                            title={rightSiderCollapsed ? '展开实时动态' : '收起实时动态'}
                        />
                    )}
                </Space>
            </Header>

            {isMobile ? renderMobileLayout() : renderDesktopLayout()}

            <Footer style={{
                padding: '12px 24px',
                background: '#fff',
                borderTop: '2px solid #f0f5ff',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <TextArea
                        placeholder="输入全局指令，如：'让所有角色去公园集合'、'触发一个新的剧情事件'..."
                        value={commandText}
                        onChange={e => setCommandText(e.target.value)}
                        onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSendCommand(); } }}
                        autoSize={{ minRows: 1, maxRows: 3 }}
                        style={{ flex: 1, borderRadius: 12, border: '2px solid #f0f5ff' }}
                    />
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={handleSendCommand}
                        loading={loading}
                        style={{ height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}
                    >
                        发送指令
                    </Button>
                </div>
            </Footer>

            <Drawer
                title={<Space><UserOutlined />角色详情</Space>}
                placement="right"
                size="default"
                open={drawerVisible}
                onClose={() => setDrawerVisible(false)}
            >
                {selectedCharacter && (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                            <Avatar
                                src={selectedCharacter.imageUrl || selectedCharacter.avatarUrl}
                                icon={!selectedCharacter.imageUrl && !selectedCharacter.avatarUrl && <UserOutlined />}
                                size={80}
                                style={{ backgroundColor: selectedCharacter.isOnline ? '#52c41a' : '#999', border: '3px solid #f0f5ff' }}
                            />
                            <Title level={4} style={{ marginTop: 12, marginBottom: 4 }}>{selectedCharacter.name}</Title>
                            <Space>
                                <Tag color={selectedCharacter.isOnline ? 'success' : 'default'}>
                                    {selectedCharacter.isOnline ? '在线' : '离线'}
                                </Tag>
                                <Tag icon={<EnvironmentOutlined />} color="blue">
                                    {selectedCharacter.currentScene || '未知'}
                                </Tag>
                            </Space>
                        </div>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="角色描述">{selectedCharacter.description}</Descriptions.Item>
                            {selectedCharacter.plotSetting && (
                                <Descriptions.Item label="核心情节">{selectedCharacter.plotSetting}</Descriptions.Item>
                            )}
                        </Descriptions>
                        <Button
                            type="primary"
                            icon={<MessageOutlined />}
                            block
                            style={{ marginTop: 24 }}
                            onClick={() => selectedCharacter && navigate(`/town/${novelId}/character/${selectedCharacter.id}?tab=chat`)}
                        >
                            查看完整详情与私聊
                        </Button>
                    </>
                )}
            </Drawer>
        </Layout>
    );
};

export default TownVisualizationPage;
