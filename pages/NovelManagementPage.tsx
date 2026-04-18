import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Card, Typography, message, Modal, Descriptions, Avatar } from 'antd';
import { EyeOutlined, DeleteOutlined, SyncOutlined, HomeOutlined, UserOutlined } from '@ant-design/icons';

const { Title } = Typography;

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

  // 获取小说列表
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

  // 获取小说详情
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

  // 解析小说
  const parseNovel = async (id: number) => {
    setParseLoading(id);
    try {
      const response = await fetch(`/api/novel/${id}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      console.log('解析响应:', result);

      if (result.code === 200) {
        message.success('解析成功！');
        // 重新获取小说列表，更新解析状态
        fetchNovels(currentPage, pageSize);
        // 显示解析出的角色
        if (result.data?.characters && Array.isArray(result.data.characters)) {
          console.log('设置角色数据:', result.data.characters.length, '个角色');
          setCharacters(result.data.characters);
          setCharactersVisible(true);
        } else {
          console.warn('角色数据格式错误:', result.data?.characters);
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

  // 初始化时获取小说列表
  useEffect(() => {
    fetchNovels(currentPage, pageSize);
  }, [currentPage, pageSize]);

  // 处理分页变化
  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  // 处理查看详情
  const handleViewDetail = (record: Novel) => {
    fetchNovelDetail(record.id);
  };

  // 处理删除小说
  const handleDelete = async (record: Novel) => {
    try {
      const response = await fetch(`/api/novel/${record.id}`, {
        method: 'DELETE',
      });
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
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '解析状态',
      dataIndex: 'parseStatus',
      key: 'parseStatus',
      render: (status: string) => {
        const statusMap: Record<string, string> = {
          UNPARSED: '未解析',
          PARSING: '解析中',
          PARSED: '已解析',
          FAILED: '解析失败'
        };
        return statusMap[status] || status;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Novel) => (
        <div>
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            style={{ marginRight: '8px' }}
          >
            查看
          </Button>
          {record.parseStatus === 'UNPARSED' && (
            <Button
              icon={<SyncOutlined />}
              onClick={() => parseNovel(record.id)}
              loading={parseLoading === record.id}
              style={{ marginRight: '8px' }}
            >
              解析角色
            </Button>
          )}
          {record.parseStatus === 'PARSED' && (
            <Button
              type="primary"
              icon={<HomeOutlined />}
              onClick={() => navigate(`/town/${record.id}`)}
              style={{ marginRight: '8px' }}
            >
              进入小镇
            </Button>
          )}
          <Button
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            danger
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      <Title level={1}>小说管理</Title>

      <Card>
        <Table
          columns={columns}
          dataSource={novels}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            onChange: handlePageChange,
          }}
        />
      </Card>

      {/* 小说详情模态框 */}
      <Modal
        title="小说详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {currentNovel && (
          <div>
            <Descriptions bordered>
              <Descriptions.Item label="标题">{currentNovel.title}</Descriptions.Item>
              <Descriptions.Item label="作者">{currentNovel.author}</Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {new Date(currentNovel.uploadTime).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="解析状态">
                {currentNovel.parseStatus === 'UNPARSED' ? '未解析' :
                  currentNovel.parseStatus === 'PARSING' ? '解析中' :
                    currentNovel.parseStatus === 'PARSED' ? '已解析' : '解析失败'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {currentNovel.remark || '-'}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: '20px' }}>
              <Title level={4}>内容</Title>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {currentNovel.content}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 角色列表模态框 */}
      <Modal
        title="解析结果 - 角色列表"
        open={charactersVisible}
        onCancel={() => setCharactersVisible(false)}
        footer={[
          <Button key="close" onClick={() => setCharactersVisible(false)}>
            关闭
          </Button>,
        ]}
        width={900}
      >
        <Table
          columns={[
            {
              title: '头像',
              key: 'avatar',
              width: 70,
              render: (_: unknown, record: Character) => {
                const imgSrc = record.imageUrl || record.avatarUrl
                return (
                  <Avatar
                    src={imgSrc}
                    icon={!imgSrc && <UserOutlined />}
                    size={40}
                    style={{ backgroundColor: imgSrc ? undefined : '#667eea' }}
                  >
                    {!imgSrc ? record.name?.charAt(0) : undefined}
                  </Avatar>
                )
              }
            },
            {
              title: '角色名称',
              dataIndex: 'name',
              key: 'name',
              width: 100,
            },
            {
              title: '人设描述',
              dataIndex: 'description',
              key: 'description',
              ellipsis: true,
              width: 200,
              render: (text: any) => typeof text === 'string' ? text : JSON.stringify(text)
            },
            {
              title: '核心情节',
              dataIndex: 'plotSetting',
              key: 'plotSetting',
              ellipsis: true,
              width: 150,
              render: (text: any) => typeof text === 'string' ? text : JSON.stringify(text)
            },
            {
              title: '出场情节',
              dataIndex: '出场情节',
              key: '出场情节',
              ellipsis: true,
              width: 100,
              render: (text: any) => typeof text === 'string' ? text : JSON.stringify(text)
            },
            {
              title: '关系网络',
              dataIndex: 'relationships',
              key: 'relationships',
              ellipsis: true,
              width: 150,
              render: (text: any) => {
                if (!text) return '-';
                try {
                  const rels = typeof text === 'string' ? JSON.parse(text) : text;
                  if (Array.isArray(rels)) {
                    return rels.map((r: any) => `${r.name}（${r.relation}）`).join(', ');
                  }
                } catch { }
                return typeof text === 'string' ? text : JSON.stringify(text);
              }
            },
            {
              title: '经典台词',
              dataIndex: 'classicLines',
              key: 'classicLines',
              ellipsis: true,
              width: 150,
              render: (text: any) => {
                if (!text) return '-';
                try {
                  const lines = typeof text === 'string' ? JSON.parse(text) : text;
                  if (Array.isArray(lines)) {
                    return lines.slice(0, 2).join('; ');
                  }
                } catch { }
                return typeof text === 'string' ? text : JSON.stringify(text);
              }
            },
          ]}
          dataSource={characters}
          rowKey="id"
          scroll={{ x: 850 }}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default NovelManagementPage;