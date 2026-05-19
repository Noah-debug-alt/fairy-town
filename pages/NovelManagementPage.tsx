import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography, message, Modal, Descriptions, Avatar, Tag, Row, Col, Empty, Spin, Tooltip, Space } from 'antd';
import {
    EyeOutlined, DeleteOutlined, SyncOutlined, HomeOutlined, UserOutlined,
    BookOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
    PlusOutlined, FileTextOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface Novel {
    id: number;
    title: string;
    author: string;
    content: string;
    uploadTime: string;
    parseStatus: string;
    remark: string | null;
    createdAt: string;
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
    createdAt: string;
    updatedAt: string;
}

const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    UNPARSED: { color: 'default', text: '未解析', icon: <ExclamationCircleOutlined /> },
    PARSING: { color: 'processing', text: '解析中', icon: <SyncOutlined spin /> },
    PARSED: { color: 'success', text: '已解析', icon: <CheckCircleOutlined /> },
    FAILED: { color: 'error', text: '解析失败', icon: <ExclamationCircleOutlined /> },
};

const NovelManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [novels, setNovels] = useState<Novel[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [detailVisible, setDetailVisible] = useState(false);
    const [charactersVisible, setCharactersVisible] = useState(false);
    const [currentNovel, setCurrentNovel] = useState<Novel | null>(null);
    const [characters, setCharacters] = useState<Character[]>([]);
    const [parseLoading, setParseLoading] = useState<number | null>(null);

    const fetchNovels = async (page: number, size: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/novel/list?page=${page}&pageSize=${size}`);
            const result = await response.json();
            if (result.code === 200) {
                setNovels(result.data.list);
                setTotal(result.data.pagination.total);
            } else {
                message.error(result.message);
            }
        } catch (error) {
            message.error('获取小说列表失败');
            console.error('获取小说列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchNovelDetail = async (id: number) => {
        try {
            const response = await fetch(`/api/novel/${id}`);
            const result = await response.json();
            if (result.code === 200) {
                setCurrentNovel(result.data);
                setDetailVisible(true);
            } else {
                message.error(result.message);
            }
        } catch (error) {
            message.error('获取小说详情失败');
            console.error('获取小说详情失败:', error);
        }
    };

    const parseNovel = async (id: number) => {
        setParseLoading(id);
        try {
            const response = await fetch(`/api/novel/${id}/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const result = await response.json();
            if (result.code === 200) {
                message.success('解析成功！');
                fetchNovels(currentPage, pageSize);
                if (result.data?.characters && Array.isArray(result.data.characters)) {
                    setCharacters(result.data.characters);
                    setCharactersVisible(true);
                } else {
                    message.warning('角色数据格式异常');
                }
            } else {
                message.error(result.message || '解析失败');
            }
        } catch (error) {
            message.error('解析失败，请稍后重试');
            console.error('解析小说失败:', error);
        } finally {
            setParseLoading(null);
        }
    };

    const handleDelete = async (record: Novel) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除小说「${record.title}」吗？此操作不可撤销。`,
            okText: '确认删除',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const response = await fetch(`/api/novel/${record.id}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (result.code === 200) {
                        message.success('删除成功');
                        fetchNovels(currentPage, pageSize);
                    } else {
                        message.error(result.message);
                    }
                } catch (error) {
                    message.error('删除失败');
                    console.error('删除小说失败:', error);
                }
            },
        });
    };

    useEffect(() => {
        fetchNovels(currentPage, pageSize);
    }, [currentPage, pageSize]);

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f0f2f5 0%, #e6e9f0 100%)' }}>
            {/* 顶部区域 */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '32px 24px 48px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    pointerEvents: 'none'
                }} />
                <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 48, height: 48, borderRadius: 14,
                                    background: 'rgba(255,255,255,0.2)'
                                }}>
                                    <BookOutlined style={{ fontSize: 24, color: '#fff' }} />
                                </div>
                                <Title level={2} style={{ color: '#fff', margin: 0 }}>小说管理</Title>
                            </div>
                            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15 }}>
                                管理你的小说，解析角色，进入小镇
                            </Text>
                        </div>
                        <Button
                            icon={<PlusOutlined />}
                            size="large"
                            onClick={() => navigate('/')}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                color: '#fff',
                                borderRadius: 12,
                                height: 44
                            }}
                        >
                            上传新小说
                        </Button>
                    </div>
                </div>
            </div>

            {/* 小说列表 */}
            <div style={{ maxWidth: 1100, margin: '-24px auto 0', padding: '0 24px 60px', position: 'relative', zIndex: 2 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60 }}>
                        <Spin size="large" />
                    </div>
                ) : novels.length === 0 ? (
                    <Card style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <span>
                                    <Text type="secondary">还没有上传小说</Text>
                                    <br />
                                    <Button type="link" onClick={() => navigate('/')}>立即上传</Button>
                                </span>
                            }
                        />
                    </Card>
                ) : (
                    <Row gutter={[20, 20]}>
                        {novels.map((novel) => {
                            const status = statusConfig[novel.parseStatus] || statusConfig.UNPARSED;
                            return (
                                <Col xs={24} sm={12} lg={8} key={novel.id}>
                                    <Card
                                        style={{
                                            borderRadius: 16,
                                            border: 'none',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                            height: '100%'
                                        }}
                                        hoverable
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                                                background: novel.parseStatus === 'PARSED'
                                                    ? 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)'
                                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                            }}>
                                                <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <Title level={5} style={{ margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {novel.title}
                                                </Title>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {novel.author || '未知作者'}
                                                </Text>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <Tag icon={status.icon} color={status.color} style={{ margin: 0, borderRadius: 8 }}>
                                                {status.text}
                                            </Tag>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                <ClockCircleOutlined style={{ marginRight: 4 }} />
                                                {new Date(novel.uploadTime).toLocaleDateString()}
                                            </Text>
                                        </div>

                                        {novel.remark && (
                                            <Paragraph
                                                type="secondary"
                                                ellipsis={{ rows: 2 }}
                                                style={{ fontSize: 12, marginBottom: 12, minHeight: 36 }}
                                            >
                                                {novel.remark}
                                            </Paragraph>
                                        )}

                                        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                                            <Tooltip title="查看详情">
                                                <Button
                                                    icon={<EyeOutlined />}
                                                    onClick={() => fetchNovelDetail(novel.id)}
                                                    style={{ borderRadius: 8, flex: 1 }}
                                                >
                                                    详情
                                                </Button>
                                            </Tooltip>
                                            {novel.parseStatus === 'UNPARSED' && (
                                                <Button
                                                    icon={<SyncOutlined />}
                                                    onClick={() => parseNovel(novel.id)}
                                                    loading={parseLoading === novel.id}
                                                    style={{ borderRadius: 8, flex: 1 }}
                                                >
                                                    解析
                                                </Button>
                                            )}
                                            {novel.parseStatus === 'PARSED' && (
                                                <Button
                                                    type="primary"
                                                    icon={<HomeOutlined />}
                                                    onClick={() => navigate(`/town/${novel.id}`)}
                                                    style={{
                                                        borderRadius: 8, flex: 1,
                                                        background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                                                        border: 'none'
                                                    }}
                                                >
                                                    进入小镇
                                                </Button>
                                            )}
                                            <Tooltip title="删除">
                                                <Button
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleDelete(novel)}
                                                    danger
                                                    style={{ borderRadius: 8 }}
                                                />
                                            </Tooltip>
                                        </div>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>
                )}

                {/* 分页 */}
                {total > pageSize && (
                    <div style={{ textAlign: 'center', marginTop: 24 }}>
                        <Space>
                            <Button
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                            >
                                上一页
                            </Button>
                            <Text>{currentPage} / {Math.ceil(total / pageSize)}</Text>
                            <Button
                                disabled={currentPage >= Math.ceil(total / pageSize)}
                                onClick={() => setCurrentPage(p => p + 1)}
                            >
                                下一页
                            </Button>
                        </Space>
                    </div>
                )}
            </div>

            {/* 小说详情弹窗 */}
            <Modal
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={700}
                styles={{ body: { padding: 0 } }}
            >
                {currentNovel && (() => {
                    const status = statusConfig[currentNovel.parseStatus] || statusConfig.UNPARSED;
                    return (
                        <>
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                padding: '24px 24px 28px',
                                color: '#fff',
                                position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                                    opacity: 0.3, pointerEvents: 'none'
                                }} />
                                <Tag icon={status.icon} color={status.color === 'default' ? undefined : status.color} style={{
                                    background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff',
                                    marginBottom: 12, borderRadius: 8
                                }}>
                                    {status.text}
                                </Tag>
                                <Title level={3} style={{ color: '#fff', margin: 0 }}>
                                    {currentNovel.title}
                                </Title>
                                <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                                    {currentNovel.author || '未知作者'} · {new Date(currentNovel.uploadTime).toLocaleString()}
                                </Text>
                            </div>
                            <div style={{ padding: 24 }}>
                                {currentNovel.remark && (
                                    <div style={{ marginBottom: 16, padding: 12, background: '#f8f9fa', borderRadius: 10 }}>
                                        <Text type="secondary" style={{ fontSize: 12 }}>备注</Text>
                                        <Paragraph style={{ margin: '4px 0 0', color: '#666' }}>{currentNovel.remark}</Paragraph>
                                    </div>
                                )}
                                <Title level={5}>小说内容</Title>
                                <div style={{
                                    maxHeight: 300, overflow: 'auto', padding: 16,
                                    background: '#fafafa', borderRadius: 10,
                                    borderLeft: '4px solid #667eea'
                                }}>
                                    <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0 }}>
                                        {currentNovel.content}
                                    </Paragraph>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                                    <Button onClick={() => setDetailVisible(false)} style={{ borderRadius: 8 }}>
                                        关闭
                                    </Button>
                                    {currentNovel.parseStatus === 'UNPARSED' && (
                                        <Button
                                            type="primary"
                                            icon={<SyncOutlined />}
                                            onClick={() => { setDetailVisible(false); parseNovel(currentNovel.id); }}
                                            style={{ borderRadius: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}
                                        >
                                            解析角色
                                        </Button>
                                    )}
                                    {currentNovel.parseStatus === 'PARSED' && (
                                        <Button
                                            type="primary"
                                            icon={<HomeOutlined />}
                                            onClick={() => navigate(`/town/${currentNovel.id}`)}
                                            style={{ borderRadius: 8, background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)', border: 'none' }}
                                        >
                                            进入小镇
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    );
                })()}
            </Modal>

            {/* 角色列表弹窗 */}
            <Modal
                title={<span><UserOutlined style={{ marginRight: 8 }} />解析结果 - 角色列表</span>}
                open={charactersVisible}
                onCancel={() => setCharactersVisible(false)}
                footer={<Button onClick={() => setCharactersVisible(false)} style={{ borderRadius: 8 }}>关闭</Button>}
                width={900}
            >
                <Row gutter={[16, 16]}>
                    {characters.map((char) => (
                        <Col xs={24} sm={12} md={8} key={char.id}>
                            <Card
                                size="small"
                                style={{ borderRadius: 12, height: '100%' }}
                                bodyStyle={{ padding: 16 }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <Avatar
                                        src={char.imageUrl || char.avatarUrl}
                                        icon={!char.imageUrl && !char.avatarUrl && <UserOutlined />}
                                        size={40}
                                        style={{ backgroundColor: (char.imageUrl || char.avatarUrl) ? undefined : '#667eea' }}
                                    >
                                        {!char.imageUrl && !char.avatarUrl ? char.name?.charAt(0) : undefined}
                                    </Avatar>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text strong style={{ fontSize: 14 }}>{char.name}</Text>
                                    </div>
                                </div>
                                <Paragraph
                                    type="secondary"
                                    ellipsis={{ rows: 2 }}
                                    style={{ fontSize: 12, marginBottom: 4 }}
                                >
                                    {typeof char.description === 'string' ? char.description : JSON.stringify(char.description)}
                                </Paragraph>
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Modal>
        </div>
    );
};

export default NovelManagementPage;
