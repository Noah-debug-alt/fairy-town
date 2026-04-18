import React, { useState, useEffect } from 'react';
import { Layout, List, Button, Card, Typography, Descriptions, Tag, Space, Empty, Divider, message, Popconfirm, Input, Select, Collapse, Drawer, Avatar, Skeleton, Tabs, Timeline, Spin } from 'antd';
import { HomeOutlined, PlusOutlined, EyeOutlined, DeleteOutlined, SyncOutlined, BookOutlined, EnterOutlined, SearchOutlined, UserOutlined, ClockCircleOutlined, StarOutlined } from '@ant-design/icons';
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

  useEffect(() => {
    fetchNovels();
  }, []);

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
      if (result.code === 200) {
        setAllNovels(result.data.list);
        setNovels(result.data.list);
      } else message.error(result.message);
    } catch { message.error('获取小说列表失败'); }
    finally { setLoading(false); }
  };

  const fetchNovelDetail = async (id: number) => {
    setCharactersLoading(true);
    try {
      const res = await fetch(`/api/novel/${id}`);
      const result = await res.json();
      if (result.code === 200) {
        setSelectedNovel(result.data);
        setCharacters(result.data.characters || []);
      } else message.error(result.message);
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
    return <Tag color={c.color}>{c.text}</Tag>;
  };

  const getStatusTag = (s: string) => {
    const m: Record<string, { color: string; text: string }> = { UNPARSED: { color: 'default', text: '未解析' }, PARSING: { color: 'processing', text: '解析中' }, PARSED: { color: 'success', text: '已解析' }, FAILED: { color: 'error', text: '解析失败' } };
    const c = m[s] || { color: 'default', text: s };
    return <Tag color={c.color}>{c.text}</Tag>;
  };

  const siderW = screenWidth < 900 ? 300 : screenWidth < 1200 ? 350 : 400;
  const isMobile = screenWidth < 768;

  const renderSkeleton = () => <div style={{ padding: 16 }}>{[1, 2, 3].map(i => <div key={i} style={{ padding: 12, borderBottom: '1px solid #f0' }}><Skeleton avatar active paragraph={{ rows: 2 }} /></div>)}</div>;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: isMobile ? '0 12px' : '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, minHeight: 64 }}>
        <Space><BookOutlined style={{ fontSize: 24, color: '#1890ff' }} /><Title level={4} style={{ margin: 0 }}>小说与角色管理中心</Title></Space>
        <Space><Button icon={<HomeOutlined />} onClick={() => navigate('/')}>{isMobile ? '' : '返回首页'}</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/')}>{isMobile ? '' : '新增小说'}</Button></Space>
      </Header>
      <Layout>
        <Sider width={siderW} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', overflow: 'auto', maxHeight: 'calc(100vh - 64px)' }} breakpoint="lg">
          <div style={{ padding: 16 }}><Title level={5}>小说列表</Title><Space direction="vertical" style={{ width: '100%', marginBottom: 12 }} size="small">
            <Input placeholder="搜索标题" prefix={<SearchOutlined />} value={searchTitle} onChange={e => setSearchTitle(e.target.value)} allowClear />
            <Select placeholder="筛选状态" value={filterStatus} onChange={setFilterStatus} allowClear style={{ width: '100%' }} options={[{ value: 'UNPARSED', label: '未解析' }, { value: 'PARSING', label: '解析中' }, { value: 'PARSED', label: '已解析' }, { value: 'FAILED', label: '解析失败' }]} />
          </Space></div>
          {loading ? renderSkeleton() : <List dataSource={novels} locale={{ emptyText: '暂无小说' }} renderItem={item => (
            <List.Item style={{ padding: '12px 16px', cursor: 'pointer', background: selectedNovel?.id === item.id ? '#e6f7ff' : 'transparent', borderLeft: selectedNovel?.id === item.id ? '3px solid #1890ff' : '3px solid transparent' }} onClick={() => fetchNovelDetail(item.id)}>
              <List.Item.Meta title={<Space><Text strong ellipsis style={{ maxWidth: 150 }}>{item.title}</Text>{getStatusTag(item.parseStatus)}</Space>} description={<Space direction="vertical" size={0}><Text type="secondary" style={{ fontSize: 12 }}>作者：{item.author || '未知'}</Text><Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.uploadTime).toLocaleString()}</Text></Space>} />
              <Space wrap>
                <Button size="small" icon={<EyeOutlined />} onClick={e => { e.stopPropagation(); fetchNovelDetail(item.id); }}>{isMobile ? '' : '查看'}</Button>
                {(item.parseStatus === 'UNPARSED' || item.parseStatus === 'FAILED') && <Button size="small" icon={<SyncOutlined />} onClick={e => { e.stopPropagation(); parseNovel(item.id); }} loading={parseLoading === item.id}>{isMobile ? '' : '解析'}</Button>}
                {item.parseStatus === 'PARSED' && <Button size="small" icon={<EnterOutlined />} onClick={e => { e.stopPropagation(); navigate(`/town/${item.id}`); }}>{isMobile ? '' : '小镇'}</Button>}
                <Popconfirm title="确认删除" description="确定删除？" onConfirm={e => { e?.stopPropagation(); handleDelete(item.id); }}>
                  <Button size="small" icon={<DeleteOutlined />} danger onClick={e => e.stopPropagation()} loading={deleteLoading === item.id}>{isMobile ? '' : '删除'}</Button>
                </Popconfirm>
              </Space>
            </List.Item>
          )} />}
        </Sider>
        <Content style={{ padding: isMobile ? 12 : 24, background: '#f5f5f5', overflow: 'auto', minHeight: 'calc(100vh - 64px)' }}>
          {charactersLoading ? <div><Card style={{ marginBottom: 16 }}><Skeleton active paragraph={{ rows: 4 }} /></Card><Card><Skeleton active paragraph={{ rows: 6 }} /></Card></div> : selectedNovel ? (
            <div>
              <Card style={{ marginBottom: isMobile ? 8 : 16 }}>
                <Descriptions title="小说详情" bordered column={isMobile ? 1 : 2} size="small">
                  <Descriptions.Item label="标题">{selectedNovel.title}</Descriptions.Item><Descriptions.Item label="作者">{selectedNovel.author || '未知'}</Descriptions.Item>
                  <Descriptions.Item label="上传时间">{new Date(selectedNovel.uploadTime).toLocaleString()}</Descriptions.Item><Descriptions.Item label="解析状态">{getStatusTag(selectedNovel.parseStatus)}</Descriptions.Item>
                  <Descriptions.Item label="备注" span={isMobile ? 1 : 2}>{selectedNovel.remark || '-'}</Descriptions.Item>
                </Descriptions>
                <Collapse ghost style={{ marginTop: 16 }}><Panel header="查看原文内容" key="content"><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, maxHeight: 400, overflow: 'auto' }}>{selectedNovel.content}</div></Panel></Collapse>
              </Card>
              <Card><Divider style={{ marginRight: 'auto' }}>角色列表</Divider>
                {characters.length > 0 ? <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(150px, 1fr))' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: isMobile ? 8 : 16 }}>
                  {characters.map(c => <Card hoverable key={c.id} onClick={() => handleCharacterClick(c)} cover={<div style={{ height: isMobile ? 80 : 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>{c.avatarUrl ? <img src={c.avatarUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Avatar size={isMobile ? 50 : 80} icon={<UserOutlined />} />}</div>} styles={{ body: { padding: isMobile ? 8 : 12 } }}><Card.Meta title={<Text strong ellipsis>{c.name}</Text>} description={<Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 12, color: '#666' }}>{c.description}</Paragraph>} /></Card>)}
                </div> : <Empty description={selectedNovel.parseStatus === 'PARSED' ? '暂无角色' : '请先解析'} />}
              </Card>
            </div>
          ) : <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}><Empty description="请选择小说" /></div>}
        </Content>
      </Layout>
      <Drawer title="角色详情" placement="right" width={isMobile ? '100%' : 520} open={characterDrawerVisible} onClose={() => setCharacterDrawerVisible(false)}>
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
                      {selectedCharacter.avatarUrl
                        ? <img src={selectedCharacter.avatarUrl} alt={selectedCharacter.name} style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover' }} />
                        : <Avatar size={100} icon={<UserOutlined />} />}
                      <Title level={3} style={{ marginTop: 12, marginBottom: 0 }}>{selectedCharacter.name}</Title>
                    </div>
                    <Descriptions column={1} bordered size="small">
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
                                    <div key={i} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                                      <Text strong>{r.name}</Text>
                                      <Tag color="blue" style={{ marginLeft: 8 }}>{r.relation}</Tag>
                                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{r.description}</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return selectedCharacter.relationships || '-';
                          } catch {
                            return selectedCharacter.relationships || '-';
                          }
                        })()}
                      </Descriptions.Item>
                      <Descriptions.Item label="台词">
                        {(() => {
                          try {
                            const dialogues = selectedCharacter.classicLines || selectedCharacter.出场情节;
                            let parsedDialogues: string[] = [];
                            if (typeof dialogues === 'string') {
                              parsedDialogues = JSON.parse(dialogues);
                            } else if (Array.isArray(dialogues)) {
                              parsedDialogues = dialogues;
                            }
                            if (parsedDialogues.length > 0) {
                              return (
                                <div style={{ padding: '8px 0', maxHeight: 300, overflow: 'auto' }}>
                                  {parsedDialogues.map((d: string, i: number) => (
                                    <div key={i} style={{ marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4, borderLeft: '3px solid #1890ff' }}>
                                      <div style={{ marginTop: 4, fontStyle: 'italic' }}>"{d}"</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return dialogues || '-';
                          } catch {
                            return selectedCharacter.classicLines || selectedCharacter.出场情节 || '-';
                          }
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
                        onClick={async () => {
                          if (!selectedCharacter) return;
                          try {
                            const res = await fetch(`/api/character/${selectedCharacter.id}/reflect`, { method: 'POST' });
                            const result = await res.json();
                            if (result.code === 200) {
                              message.success(`成功生成 ${result.data.count} 条反思`);
                              fetchMemories(selectedCharacter.id, 1);
                            } else {
                              message.error(result.message || '生成反思失败');
                            }
                          } catch {
                            message.error('生成反思失败');
                          }
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
                                <div
                                  key={m.id}
                                  style={{
                                    paddingBottom: 8,
                                    padding: m.type === 'REFLECTION' ? '8px' : 0,
                                    margin: m.type === 'REFLECTION' ? '-8px 0' : 0,
                                    borderRadius: m.type === 'REFLECTION' ? '4px' : 0,
                                    border: m.type === 'REFLECTION' ? '1px solid #d3adf7' : 'none',
                                    background: m.type === 'REFLECTION' ? '#f9f0ff' : 'transparent'
                                  }}
                                >
                                  <Space style={{ marginBottom: 4 }}>
                                    {getMemoryTypeTag(m.type)}
                                    <Tag icon={<StarOutlined />} color={m.importance >= 8 ? 'gold' : m.importance >= 5 ? 'processing' : 'default'}>重要:{m.importance}</Tag>
                                    <Text type="secondary" style={{ fontSize: 12 }}><ClockCircleOutlined /> {new Date(m.timestamp).toLocaleString()}</Text>
                                  </Space>
                                  <Paragraph style={{ marginBottom: 4 }}>{m.content}</Paragraph>
                                  {m.tags && m.tags.length > 0 && (
                                    <Space size={4}>
                                      {m.tags.map((t, i) => <Tag key={i} style={{ fontSize: 10 }}>{t}</Tag>)}
                                    </Space>
                                  )}
                                </div>
                              )
                            }))}
                          />
                          {memoryPagination.total > memoryPagination.pageSize && (
                            <div style={{ textAlign: 'center', marginTop: 16 }}>
                              <Button size="small" onClick={() => fetchMemories(selectedCharacter.id, memoryPagination.page + 1)} loading={memoriesLoading}>加载更多</Button>
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
    </Layout>
  );
};

export default ManagerPage;
