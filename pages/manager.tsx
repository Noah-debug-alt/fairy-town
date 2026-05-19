import React, { useState, useEffect } from 'react';
import { Layout, Button, Card, Typography, Descriptions, Tag, Space, Empty, Divider, message, Popconfirm, Input, Select, Collapse, Drawer, Avatar, Skeleton, Tabs, Timeline, Spin, Badge } from 'antd';
import { HomeOutlined, PlusOutlined, EyeOutlined, DeleteOutlined, SyncOutlined, BookOutlined, EnterOutlined, SearchOutlined, UserOutlined, ClockCircleOutlined, StarOutlined, FileTextOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface Novel {
  id: number;
  title: string;
  author: string;
  content: string;
  uploadTime: string;
  parseStatus: string;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  characters?: Character[];
}

interface Character {
  id: number;
  novelId: number;
  name: string;
  avatarUrl: string | null;
  imageUrl: string | null;
  description: string;
  plotSetting: string;
  relationships: string;
  出场情节: string;
  classicLines: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Memory {
  id: number;
  characterId: number;
  novelId: number;
  content: string;
  type: string;
  importance: number;
  tags: string[];
  timestamp: string;
  createdAt: string;
}

const statusStyleMap: Record<string, { color: string; text: string; bg: string; border: string; dot: string }> = {
  UNPARSED: { color: '#999', text: '未解析', bg: '#fafafa', border: '#e8e8e8', dot: '#bfbfbf' },
  PARSING: { color: '#1890ff', text: '解析中', bg: '#e6f7ff', border: '#91d5ff', dot: '#1890ff' },
  PARSED: { color: '#52c41a', text: '已解析', bg: '#f6ffed', border: '#b7eb8f', dot: '#52c41a' },
  FAILED: { color: '#ff4d4f', text: '解析失败', bg: '#fff1f0', border: '#ffa39e', dot: '#ff4d4f' },
};

const ManagerPage: React.FC = () => {
  const navigate = useNavigate();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [allNovels, setAllNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [searchTitle, setSearchTitle] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [characterDrawerVisible, setCharacterDrawerVisible] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoryPagination, setMemoryPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [hoveredNovelId, setHoveredNovelId] = useState<number | null>(null);

  useEffect(() => { fetchNovels(); }, []);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let filtered = allNovels;
    if (searchTitle) filtered = filtered.filter(n => n.title.toLowerCase().includes(searchTitle.toLowerCase()));
    if (filterStatus) filtered = filtered.filter(n => n.parseStatus === filterStatus);
    setNovels(filtered);
  }, [searchTitle, filterStatus, allNovels]);

  const fetchNovels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/novel/list?page=1&pageSize=100');
      const result = await res.json();
      if (result.code === 200) { setAllNovels(result.data.list); setNovels(result.data.list); }
      else message.error(result.message);
    } catch { message.error('获取小说列表失败'); }
    finally { setLoading(false); }
  };

  const fetchNovelDetail = async (id: number) => {
    setCharactersLoading(true);
    try {
      const res = await fetch(`/api/novel/${id}`);
      const result = await res.json();
      if (result.code === 200) { setSelectedNovel(result.data); setCharacters(result.data.characters || []); }
      else message.error(result.message);
    } catch { message.error('获取小说详情失败'); }
    finally { setCharactersLoading(false); }
  };

  const parseNovel = async (id: number) => {
    setParseLoading(id);
    try {
      const res = await fetch(`/api/novel/${id}/parse`, { method: 'POST' });
      const result = await res.json();
      if (result.code === 200) { message.success('解析成功'); fetchNovels(); fetchNovelDetail(id); }
      else message.error(result.message);
    } catch { message.error('解析失败'); }
    finally { setParseLoading(null); }
  };

  const handleDelete = async (id: number) => {
    setDeleteLoading(id);
    try {
      const res = await fetch(`/api/novel/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.code === 200) { message.success('删除成功'); fetchNovels(); if (selectedNovel?.id === id) { setSelectedNovel(null); setCharacters([]); } }
      else message.error(result.message);
    } catch { message.error('删除失败'); }
    finally { setDeleteLoading(null); }
  };

  const fetchMemories = async (characterId: number, page = 1) => {
    setMemoriesLoading(true);
    try {
      const res = await fetch(`/api/character/${characterId}/memory?page=${page}&pageSize=20`);
      const result = await res.json();
      if (result.code === 200) {
        setMemories(result.data.list);
        setMemoryPagination({ page: result.data.pagination.page, pageSize: result.data.pagination.pageSize, total: result.data.pagination.total });
      }
    } catch { console.error('获取记忆失败'); }
    finally { setMemoriesLoading(false); }
  };

  const handleCharacterClick = (character: Character) => {
    setSelectedCharacter(character);
    setCharacterDrawerVisible(true);
    fetchMemories(character.id, 1);
  };

  const getMemoryTypeTag = (type: string) => {
    const map: Record<string, { color: string; text: string }> = { OBSERVATION: { color: 'blue', text: '观察' }, DIALOGUE: { color: 'green', text: '对话' }, REFLECTION: { color: 'purple', text: '反思' }, PLOT: { color: 'orange', text: '剧情' } };
    const c = map[type] || { color: 'default', text: type };
    return <Tag color={c.color} style={{ borderRadius: 6 }}>{c.text}</Tag>;
  };

  const getStatusBadge = (s: string) => {
    const style = statusStyleMap[s] || statusStyleMap.UNPARSED;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 10px', borderRadius: 10, fontSize: 12,
        color: style.color, background: style.bg, border: `1px solid ${style.border}`
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: style.dot,
          boxShadow: s === 'PARSING' ? '0 0 4px ' + style.dot : 'none',
          animation: s === 'PARSING' ? 'pulse 1.5s infinite' : 'none'
        }} />
        {style.text}
      </span>
    );
  };

  const isMobile = screenWidth < 768;
  const siderW = isMobile ? 280 : 360;

  const renderSkeleton = () => (
    <div style={{ padding: 16 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ padding: 16, marginBottom: 8, borderRadius: 12, background: '#fafafa' }}>
          <Skeleton avatar={{ shape: 'square', size: 40 }} active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
        </div>
      ))}
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: isMobile ? '0 12px' : '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 56, boxShadow: '0 2px 12px rgba(102, 126, 234, 0.3)'
      }}>
        <Space>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(255,255,255,0.2)'
          }}>
            <BookOutlined style={{ fontSize: 18, color: '#fff' }} />
          </div>
          <Title level={4} style={{ margin: 0, color: '#fff', fontSize: 16 }}>小说与角色管理中心</Title>
        </Space>
        <Space size={8}>
          <Button
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, fontSize: 13 }}
          >
            {isMobile ? '' : '返回首页'}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/')}
            style={{ background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 8, fontSize: 13 }}
          >
            {isMobile ? '' : '新增小说'}
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={siderW} style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
          maxHeight: 'calc(100vh - 56px)',
          position: 'relative'
        }} breakpoint="lg">
          {/* 搜索区域 */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid #f0f0f0',
            background: 'linear-gradient(180deg, #fafbff 0%, #fff 100%)',
            position: 'sticky', top: 0, zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FileTextOutlined style={{ color: '#667eea', fontSize: 16 }} />
              <Text strong style={{ fontSize: 15 }}>小说列表</Text>
              <Badge
                count={novels.length}
                style={{ backgroundColor: '#667eea', marginLeft: 'auto' }}
                overflowCount={99}
              />
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Input
                placeholder="搜索标题..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchTitle}
                onChange={e => setSearchTitle(e.target.value)}
                allowClear
                style={{ borderRadius: 8, borderColor: '#e8e8e8' }}
              />
              <Select
                placeholder="筛选状态"
                value={filterStatus}
                onChange={setFilterStatus}
                allowClear
                style={{ width: '100%' }}
                options={[
                  { value: 'UNPARSED', label: '未解析' },
                  { value: 'PARSING', label: '解析中' },
                  { value: 'PARSED', label: '已解析' },
                  { value: 'FAILED', label: '解析失败' }
                ]}
              />
            </Space>
          </div>

          {/* 小说列表 */}
          {loading ? renderSkeleton() : novels.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无小说" />
            </div>
          ) : (
            <div style={{ padding: '8px 12px' }}>
              {novels.map(item => {
                const isSelected = selectedNovel?.id === item.id;
                const isHovered = hoveredNovelId === item.id;
                const status = statusStyleMap[item.parseStatus] || statusStyleMap.UNPARSED;

                return (
                  <div
                    key={item.id}
                    onClick={() => fetchNovelDetail(item.id)}
                    onMouseEnter={() => setHoveredNovelId(item.id)}
                    onMouseLeave={() => setHoveredNovelId(null)}
                    style={{
                      padding: '12px 14px',
                      marginBottom: 6,
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: isSelected
                        ? '1px solid #667eea'
                        : isHovered
                          ? '1px solid #e8e8e8'
                          : '1px solid transparent',
                      background: isSelected
                        ? 'linear-gradient(135deg, #f0f2ff 0%, #e8ebff 100%)'
                        : isHovered
                          ? '#fafbff'
                          : 'transparent',
                      transition: 'all 0.25s ease',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: isSelected
                        ? '0 2px 8px rgba(102, 126, 234, 0.15)'
                        : 'none'
                    }}
                  >
                    {/* 左侧状态色条 */}
                    <div style={{
                      position: 'absolute', left: 0, top: 8, bottom: 8,
                      width: 3, borderRadius: 2,
                      background: isSelected ? status.color : 'transparent',
                      transition: 'all 0.25s ease'
                    }} />

                    <div style={{ paddingLeft: 6 }}>
                      {/* 标题行 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: item.parseStatus === 'PARSED'
                            ? 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)'
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        }}>
                          <FileTextOutlined style={{ fontSize: 14, color: '#fff' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text strong ellipsis style={{ fontSize: 14, display: 'block' }}>{item.title}</Text>
                        </div>
                        {isSelected && <RightOutlined style={{ color: '#667eea', fontSize: 12 }} />}
                      </div>

                      {/* 信息行 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        {getStatusBadge(item.parseStatus)}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {item.author || '未知作者'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <ClockCircleOutlined style={{ marginRight: 2 }} />
                          {new Date(item.uploadTime).toLocaleDateString()}
                        </Text>
                      </div>

                      {/* 操作按钮行 */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={e => { e.stopPropagation(); fetchNovelDetail(item.id); }}
                          style={{ borderRadius: 6, fontSize: 12, height: 26, padding: '0 8px' }}
                        >
                          详情
                        </Button>
                        {(item.parseStatus === 'UNPARSED' || item.parseStatus === 'FAILED') && (
                          <Button
                            size="small"
                            icon={<SyncOutlined />}
                            onClick={e => { e.stopPropagation(); parseNovel(item.id); }}
                            loading={parseLoading === item.id}
                            style={{ borderRadius: 6, fontSize: 12, height: 26, padding: '0 8px' }}
                          >
                            解析
                          </Button>
                        )}
                        {item.parseStatus === 'PARSED' && (
                          <Button
                            size="small"
                            type="primary"
                            icon={<EnterOutlined />}
                            onClick={e => { e.stopPropagation(); navigate(`/town/${item.id}`); }}
                            style={{
                              borderRadius: 6, fontSize: 12, height: 26, padding: '0 8px',
                              background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                              border: 'none'
                            }}
                          >
                            小镇
                          </Button>
                        )}
                        <Popconfirm title="确认删除" description="确定删除？" onConfirm={e => { e?.stopPropagation(); handleDelete(item.id); }}>
                          <Button
                            size="small"
                            icon={<DeleteOutlined />}
                            danger
                            onClick={e => e.stopPropagation()}
                            loading={deleteLoading === item.id}
                            style={{ borderRadius: 6, fontSize: 12, height: 26, padding: '0 8px', marginLeft: 'auto' }}
                          />
                        </Popconfirm>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Sider>

        {/* 右侧内容区 */}
        <Content style={{
          padding: isMobile ? 12 : 24,
          background: 'linear-gradient(180deg, #f0f2f5 0%, #e6e9f0 100%)',
          overflow: 'auto',
          minHeight: 'calc(100vh - 56px)',
          flex: 1
        }}>
          {charactersLoading ? (
            <div>
              <Card style={{ marginBottom: 16, borderRadius: 12 }}><Skeleton active paragraph={{ rows: 4 }} /></Card>
              <Card style={{ borderRadius: 12 }}><Skeleton active paragraph={{ rows: 6 }} /></Card>
            </div>
          ) : selectedNovel ? (
            <div>
              {/* 小说信息卡片 */}
              <Card style={{
                marginBottom: isMobile ? 8 : 16,
                borderRadius: 16, border: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '20px 24px',
                  color: '#fff',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    pointerEvents: 'none'
                  }} />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 48, height: 48, borderRadius: 14,
                        background: 'rgba(255,255,255,0.2)'
                      }}>
                        <FileTextOutlined style={{ fontSize: 24, color: '#fff' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Title level={3} style={{ margin: 0, color: '#fff' }}>{selectedNovel.title}</Title>
                        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                          {selectedNovel.author || '未知作者'}
                        </Text>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        padding: '4px 14px', borderRadius: 10,
                        color: '#fff', fontSize: 13
                      }}>
                        {statusStyleMap[selectedNovel.parseStatus]?.text || '未知'}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '16px 24px' }}>
                  <Descriptions column={isMobile ? 1 : 3} size="small">
                    <Descriptions.Item label="作者">{selectedNovel.author || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="上传时间">{new Date(selectedNovel.uploadTime).toLocaleString()}</Descriptions.Item>
                    <Descriptions.Item label="解析状态">{getStatusBadge(selectedNovel.parseStatus)}</Descriptions.Item>
                    {selectedNovel.remark && (
                      <Descriptions.Item label="备注" span={3}>{selectedNovel.remark}</Descriptions.Item>
                    )}
                  </Descriptions>
                  <Collapse ghost style={{ marginTop: 8 }}>
                    <Panel header={<Text type="secondary" style={{ fontSize: 13 }}><EyeOutlined style={{ marginRight: 6 }} />查看原文内容</Text>} key="content">
                      <div style={{
                        whiteSpace: 'pre-wrap', lineHeight: 1.8, maxHeight: 400, overflow: 'auto',
                        padding: 16, background: '#fafafa', borderRadius: 10,
                        borderLeft: '4px solid #667eea'
                      }}>
                        {selectedNovel.content}
                      </div>
                    </Panel>
                  </Collapse>
                </div>
              </Card>

              {/* 角色列表卡片 */}
              <Card style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Divider style={{ fontSize: 16, color: '#667eea', fontWeight: 'bold' }}>
                  <UserOutlined style={{ marginRight: 8 }} />角色列表
                </Divider>
                {characters.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                      ? 'repeat(auto-fill, minmax(140px, 1fr))'
                      : 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: isMobile ? 8 : 16
                  }}>
                    {characters.map(c => {
                      const charImage = c.imageUrl || c.avatarUrl;
                      return (
                        <Card
                          hoverable
                          key={c.id}
                          onClick={() => handleCharacterClick(c)}
                          style={{ borderRadius: 12, overflow: 'hidden', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                          cover={
                            <div style={{
                              height: isMobile ? 80 : 110,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'linear-gradient(135deg, #f8f9ff 0%, #e6e9ff 100%)'
                            }}>
                              {charImage
                                ? <img src={charImage} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <Avatar size={isMobile ? 48 : 72} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }} icon={<UserOutlined />} />
                              }
                            </div>
                          }
                          styles={{ body: { padding: isMobile ? 8 : 12 } }}
                        >
                          <Card.Meta
                            title={<Text strong ellipsis style={{ fontSize: 14 }}>{c.name}</Text>}
                            description={<Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 12, color: '#666' }}>{c.description}</Paragraph>}
                          />
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Empty description={selectedNovel.parseStatus === 'PARSED' ? '暂无角色' : '请先解析'} />
                )}
              </Card>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
              <Empty description="请从左侧选择小说" />
            </div>
          )}
        </Content>
      </Layout>

      {/* 角色详情抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
              <UserOutlined style={{ color: '#fff' }} />
            </div>
            <span>角色详情</span>
          </div>
        }
        placement="right"
        width={isMobile ? '100%' : 520}
        open={characterDrawerVisible}
        onClose={() => setCharacterDrawerVisible(false)}
      >
        {selectedCharacter && (
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: '基本信息',
                children: (
                  <div>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                      {(selectedCharacter.imageUrl || selectedCharacter.avatarUrl)
                        ? <img src={selectedCharacter.imageUrl || selectedCharacter.avatarUrl || ''} alt={selectedCharacter.name} style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f0f0f0' }} />
                        : <Avatar size={100} icon={<UserOutlined />} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }} />
                      }
                      <Title level={3} style={{ marginTop: 12, marginBottom: 0 }}>{selectedCharacter.name}</Title>
                    </div>
                    <Descriptions column={1} bordered size="small" style={{ borderRadius: 10 }}>
                      <Descriptions.Item label="人设">{selectedCharacter.description}</Descriptions.Item>
                      <Descriptions.Item label="剧情">{selectedCharacter.plotSetting}</Descriptions.Item>
                      <Descriptions.Item label="关系">
                        {(() => {
                          try {
                            const relations = typeof selectedCharacter.relationships === 'string'
                              ? JSON.parse(selectedCharacter.relationships)
                              : selectedCharacter.relationships;
                            if (Array.isArray(relations) && relations.length > 0) {
                              return (
                                <div style={{ padding: '8px 0' }}>
                                  {relations.map((r: any, i: number) => (
                                    <div key={i} style={{ marginBottom: 8, padding: 10, background: '#f8f9ff', borderRadius: 8, borderLeft: '3px solid #667eea' }}>
                                      <Text strong>{r.name}</Text>
                                      <Tag color="blue" style={{ marginLeft: 8, borderRadius: 6 }}>{r.relation}</Tag>
                                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{r.description}</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return selectedCharacter.relationships || '-';
                          } catch { return selectedCharacter.relationships || '-'; }
                        })()}
                      </Descriptions.Item>
                      <Descriptions.Item label="台词">
                        {(() => {
                          try {
                            const dialogues = selectedCharacter.classicLines || selectedCharacter.出场情节;
                            let parsedDialogues: string[] = [];
                            if (typeof dialogues === 'string') { parsedDialogues = JSON.parse(dialogues); }
                            else if (Array.isArray(dialogues)) { parsedDialogues = dialogues; }
                            if (parsedDialogues.length > 0) {
                              return (
                                <div style={{ padding: '8px 0', maxHeight: 300, overflow: 'auto' }}>
                                  {parsedDialogues.map((d: string, i: number) => (
                                    <div key={i} style={{ marginBottom: 8, padding: 10, background: '#fafafa', borderRadius: 8, borderLeft: '3px solid #667eea' }}>
                                      <div style={{ fontStyle: 'italic' }}>"{d}"</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return dialogues || '-';
                          } catch { return selectedCharacter.classicLines || selectedCharacter.出场情节 || '-'; }
                        })()}
                      </Descriptions.Item>
                    </Descriptions>
                  </div>
                )
              },
              {
                key: 'memory',
                label: `记忆流 ${memoryPagination.total > 0 ? `(${memoryPagination.total})` : ''}`,
                children: (
                  <div>
                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<StarOutlined />}
                        loading={memoriesLoading}
                        style={{ borderRadius: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}
                        onClick={async () => {
                          if (!selectedCharacter) return;
                          try {
                            const res = await fetch(`/api/character/${selectedCharacter.id}/reflect`, { method: 'POST' });
                            const result = await res.json();
                            if (result.code === 200) { message.success(`成功生成 ${result.data.count} 条反思`); fetchMemories(selectedCharacter.id, 1); }
                            else { message.error(result.message || '生成反思失败'); }
                          } catch { message.error('生成反思失败'); }
                        }}
                      >
                        手动触发反思
                      </Button>
                    </div>
                    {memoriesLoading
                      ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                      : memories.length > 0 ? (
                        <div>
                          <Timeline
                            style={{ marginTop: 16 }}
                            items={memories.map(m => ({
                              color: m.type === 'REFLECTION' ? 'purple' : m.importance >= 8 ? 'gold' : m.importance >= 5 ? 'blue' : 'gray',
                              children: (
                                <div key={m.id} style={{
                                  paddingBottom: 8,
                                  padding: m.type === 'REFLECTION' ? '10px' : 0,
                                  margin: m.type === 'REFLECTION' ? '-8px 0' : 0,
                                  borderRadius: m.type === 'REFLECTION' ? 8 : 0,
                                  border: m.type === 'REFLECTION' ? '1px solid #d3adf7' : 'none',
                                  background: m.type === 'REFLECTION' ? '#f9f0ff' : 'transparent'
                                }}>
                                  <Space style={{ marginBottom: 4 }}>
                                    {getMemoryTypeTag(m.type)}
                                    <Tag icon={<StarOutlined />} color={m.importance >= 8 ? 'gold' : m.importance >= 5 ? 'processing' : 'default'} style={{ borderRadius: 6 }}>
                                      重要:{m.importance}
                                    </Tag>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      <ClockCircleOutlined /> {new Date(m.timestamp).toLocaleString()}
                                    </Text>
                                  </Space>
                                  <Paragraph style={{ marginBottom: 4 }}>{m.content}</Paragraph>
                                  {m.tags && m.tags.length > 0 && (
                                    <Space size={4}>
                                      {m.tags.map((t, i) => <Tag key={i} style={{ fontSize: 10, borderRadius: 4 }}>{t}</Tag>)}
                                    </Space>
                                  )}
                                </div>
                              )
                            }))}
                          />
                          {memoryPagination.total > memoryPagination.pageSize && (
                            <div style={{ textAlign: 'center', marginTop: 16 }}>
                              <Button size="small" onClick={() => fetchMemories(selectedCharacter.id, memoryPagination.page + 1)} loading={memoriesLoading} style={{ borderRadius: 8 }}>
                                加载更多
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无记忆" />
                    }
                  </div>
                )
              }
            ]}
          />
        )}
      </Drawer>

      {/* 解析中动画样式 */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </Layout>
  );
};

export default ManagerPage;
