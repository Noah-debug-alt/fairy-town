import { PrismaClient } from '@prisma/client';
import { analyzeNovel } from '../../../utils/llm/index';

const prisma = new PrismaClient();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    if (!id || isNaN(parseInt(id))) {
      return new Response(JSON.stringify({
        code: 400,
        message: '无效的小说ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const novelId = parseInt(id);

    const novel = await prisma.novel.findUnique({
      where: {
        id: novelId
      }
    });

    if (!novel) {
      return new Response(JSON.stringify({
        code: 404,
        message: '小说不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await prisma.novel.update({
      where: {
        id: novelId
      },
      data: {
        parseStatus: 'PARSING'
      }
    });

    const analysisResult = await analyzeNovel(novel);

    if (!Array.isArray(analysisResult.characters)) {
      await prisma.novel.update({
        where: {
          id: novelId
        },
        data: {
          parseStatus: 'FAILED'
        }
      });

      return new Response(JSON.stringify({
        code: 400,
        message: '解析失败：角色列表格式错误'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const characters = analysisResult.characters || [];
    const scenes = analysisResult.scenes || [];
    const plots = analysisResult.plots || [];
    let createdCharacters: { id: number; name: string }[] = [];

    const uniqueScenes = scenes.filter((scene, index, self) =>
      scene.name && self.findIndex(s => s.name === scene.name) === index
    );

    if (uniqueScenes.length > 0) {
      for (const scene of uniqueScenes) {
        try {
          await prisma.scene.create({
            data: {
              novelId: novelId,
              name: scene.name || '',
              description: scene.description || '',
              type: scene.type || 'public',
              positionX: 0,
              positionY: 0
            }
          });
        } catch (sceneError) {
          console.error(`创建场景 "${scene.name}" 失败:`, sceneError);
        }
      }
    }

    const uniqueCharacters = characters.filter((char, index, self) =>
      char.name && self.findIndex(c => c.name === char.name) === index
    );

    if (uniqueCharacters.length > 0) {
      for (const char of uniqueCharacters) {
        try {
          await prisma.character.create({
            data: {
              novelId: novelId,
              name: String(char.name || ''),
              avatarUrl: typeof char.avatarUrl === 'string' ? char.avatarUrl : '',
              description: typeof char.description === 'string' ? char.description : JSON.stringify(char.description || ''),
              plotSetting: typeof char.plotSetting === 'string' ? char.plotSetting : JSON.stringify(char.plotSetting || ''),
              relationships: typeof char.relationships === 'string' ? char.relationships : JSON.stringify(char.relationships || []),
              出场情节: typeof char.出场情节 === 'string' ? char.出场情节 : JSON.stringify(char.出场情节 || ''),
              coreIdentity: typeof char.coreIdentity === 'string' ? char.coreIdentity : JSON.stringify(char.coreIdentity || ''),
              classicLines: typeof char.classicLines === 'string' ? char.classicLines : JSON.stringify(char.classicLines || [])
            }
          });
        } catch (charError) {
          console.error(`创建角色 "${char.name}" 失败:`, charError);
        }
      }

      createdCharacters = await prisma.character.findMany({
        where: { novelId },
        select: { id: true, name: true }
      });

      for (const char of uniqueCharacters) {
        const charData = createdCharacters.find(c => c.name === char.name);
        if (charData && char.memories && char.memories.length > 0) {
          for (let i = 0; i < char.memories.length; i++) {
            const memoryContent = char.memories[i];
            if (memoryContent && typeof memoryContent === 'string') {
              try {
                await prisma.memory.create({
                  data: {
                    characterId: charData.id,
                    novelId: novelId,
                    content: memoryContent,
                    type: 'PLOT',
                    importance: i < 3 ? 8 : 5,
                    tags: JSON.stringify(['小说情节', '原始记忆']),
                    source: 'manual',
                    timestamp: new Date()
                  }
                });
              } catch (memoryError) {
                console.error(`创建记忆失败:`, memoryError);
              }
            }
          }
        }
      }
    }

    if (plots.length > 0) {
      const characterNameToId = new Map(createdCharacters.map(c => [c.name, c.id]));

      for (const plot of plots) {
        const involvedCharacterIds = (plot.involvedCharacterNames || [])
          .map((name: string) => characterNameToId.get(name))
          .filter((id: number | undefined): id is number => id !== undefined);

        try {
          await prisma.plot.create({
            data: {
              novelId: novelId,
              chapterIndex: plot.chapterIndex || 0,
              sceneIndex: plot.sceneIndex || 0,
              title: typeof plot.title === 'string' ? plot.title : JSON.stringify(plot.title || ''),
              content: typeof plot.content === 'string' ? plot.content : JSON.stringify(plot.content || ''),
              involvedCharacterIds: JSON.stringify(involvedCharacterIds),
              dialogueContent: typeof plot.dialogueContent === 'string' ? plot.dialogueContent : JSON.stringify(plot.dialogueContent || []),
              narrationContent: typeof plot.narrationContent === 'string' ? plot.narrationContent : JSON.stringify(plot.narrationContent || ''),
              location: typeof plot.location === 'string' ? plot.location : JSON.stringify(plot.location || ''),
              isCompleted: false
            }
          });
        } catch (plotError) {
          console.error(`创建情节 "${plot.title}" 失败:`, plotError);
        }
      }
    }

    await prisma.novel.update({
      where: {
        id: novelId
      },
      data: {
        parseStatus: 'PARSED'
      }
    });

    const responseCharacters = uniqueCharacters.map(char => ({
      id: createdCharacters.find(c => c.name === char.name)?.id || 0,
      novelId: novelId,
      name: String(char.name || ''),
      avatarUrl: typeof char.avatarUrl === 'string' ? char.avatarUrl : '',
      description: typeof char.description === 'string' ? char.description : JSON.stringify(char.description || ''),
      plotSetting: typeof char.plotSetting === 'string' ? char.plotSetting : JSON.stringify(char.plotSetting || ''),
      relationships: typeof char.relationships === 'string' ? char.relationships : JSON.stringify(char.relationships || []),
      出场情节: typeof char.出场情节 === 'string' ? char.出场情节 : JSON.stringify(char.出场情节 || ''),
      coreIdentity: typeof char.coreIdentity === 'string' ? char.coreIdentity : JSON.stringify(char.coreIdentity || ''),
      classicLines: typeof char.classicLines === 'string' ? char.classicLines : JSON.stringify(char.classicLines || []),
      memories: char.memories || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    return new Response(JSON.stringify({
      code: 200,
      message: '解析成功',
      data: {
        characters: responseCharacters,
        plots: plots,
        scenes: uniqueScenes
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('解析小说失败:', error);

    if (id && !isNaN(parseInt(id))) {
      const novelId = parseInt(id);
      try {
        await prisma.novel.update({
          where: {
            id: novelId
          },
          data: {
            parseStatus: 'FAILED'
          }
        });
      } catch (updateError) {
        console.error('更新小说解析状态失败:', updateError);
      }
    }

    return new Response(JSON.stringify({
      code: 500,
      message: '解析失败，请稍后重试'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    await prisma.$disconnect();
  }
}
