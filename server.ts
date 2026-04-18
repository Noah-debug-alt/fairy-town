import { createServer as createHttpServer } from 'http'
import { createServer as createViteServer } from 'vite'
import { IncomingMessage, ServerResponse } from 'http'

interface RequestWithBody extends IncomingMessage {
  body: string
}

interface ApiError extends Error {
  message: string
}

async function startServer() {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { overlay: false }
    }
  })

  const app = async (req: RequestWithBody, res: ServerResponse) => {
    const url = req.url || ''

    if (url.startsWith('/api/')) {
      const urlObj = new URL(url, 'http://localhost')
      const path = urlObj.pathname

      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      console.log('API请求:', req.method, path)

      try {
        // POST /novel/upload
        if (path === '/api/novel/upload' && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { title, content, author, remark } = data

              if (!title || !content) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ code: 400, message: '标题和内容不能为空' }))
                return
              }

              const { PrismaClient } = await import('@prisma/client')
              const prisma = new PrismaClient()

              const novel = await prisma.novel.create({
                data: {
                  title,
                  content,
                  author: author || '未知',
                  uploadTime: new Date(),
                  parseStatus: 'UNPARSED',
                  remark
                }
              })

              await prisma.$disconnect()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 200, message: '上传成功', data: { id: novel.id } }))
            } catch (err: ApiError) {
              console.error('上传失败:', err)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '服务器错误: ' + err.message }))
            }
          })
          return
        }

        // GET /novel/list
        if (path === '/api/novel/list' && req.method === 'GET') {
          const page = parseInt(urlObj.searchParams.get('page') || '1')
          const pageSize = parseInt(urlObj.searchParams.get('pageSize') || '10')

          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const [novels, total] = await Promise.all([
            prisma.novel.findMany({
              orderBy: { uploadTime: 'desc' },
              skip: (page - 1) * pageSize,
              take: pageSize
            }),
            prisma.novel.count()
          ])

          await prisma.$disconnect()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: {
              list: novels.map(n => ({
                id: n.id,
                title: n.title,
                author: n.author,
                content: n.content,
                uploadTime: n.uploadTime,
                parseStatus: n.parseStatus,
                remark: n.remark,
                createdAt: n.createdAt
              })),
              pagination: { total, page, pageSize }
            }
          }))
          return
        }

        // GET /novel/:id
        if (path.match(/^\/api\/novel\/\d+$/) && req.method === 'GET') {
          const id = parseInt(path.split('/')[3])
          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const novel = await prisma.novel.findUnique({
            where: { id },
            include: { characters: true }
          })

          await prisma.$disconnect()
          if (novel) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: 200, data: novel }))
            return
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 404, message: '小说不存在'
            }))
            return
          }
        }

        // DELETE /novel/:id
        if (path.match(/^\/api\/novel\/\d+$/) && req.method === 'DELETE') {
          const id = parseInt(path.split('/')[3])

          const deleteLog: string[] = []
          const startTime = Date.now()
          let db = null
          let imageDeleteErrors: string[] = []

          try {
            const { PrismaClient } = await import('@prisma/client')
            const prisma = new PrismaClient()

            const novel = await prisma.novel.findUnique({ where: { id } })
            if (!novel) {
              await prisma.$disconnect()
              res.writeHead(404, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 404, message: '小说不存在' }))
              return
            }

            deleteLog.push(`[开始删除] 小说ID: ${id}, 标题: "${novel.title}"`)

            const scenes = await prisma.scene.findMany({ where: { novelId: id } })
            const characters = await prisma.character.findMany({ where: { novelId: id } })
            const plots = await prisma.plot.findMany({ where: { novelId: id } })
            const memories = await prisma.memory.findMany({ where: { novelId: id } })
            const chatMessages = await prisma.chatMessage.findMany({ where: { novelId: id } })
            const townEvents = await prisma.townEvent.findMany({ where: { novelId: id } })

            deleteLog.push(`[数据统计] 场景: ${scenes.length}, 角色: ${characters.length}, 情节: ${plots.length}, 记忆: ${memories.length}, 聊天: ${chatMessages.length}, 事件: ${townEvents.length}`)

            const fs = await import('fs')
            const pathModule = await import('path')
            const allImageUrls: { url: string; type: string; owner: string }[] = [
              ...scenes.map(s => ({ url: s.imageUrl, type: '场景图片', owner: s.name })),
              ...characters.map(c => ({ url: c.imageUrl, type: '角色形象', owner: c.name })),
              ...characters.map(c => ({ url: c.avatarUrl, type: '角色头像', owner: c.name })),
            ].filter((item): item is { url: string; type: string; owner: string } => !!item.url && !item.url.startsWith('placeholder://'))

            let deletedImageCount = 0
            for (const imgItem of allImageUrls) {
              try {
                const filePath = pathModule.join(process.cwd(), 'public', imgItem.url)
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath)
                  deletedImageCount++
                  deleteLog.push(`[删除图片] ${imgItem.type} - ${imgItem.owner}: ${imgItem.url}`)
                }
              } catch (e) {
                const errMsg = `删除图片失败: ${imgItem.type} - ${imgItem.owner} (${imgItem.url})`
                console.error(errMsg, e)
                imageDeleteErrors.push(errMsg)
                deleteLog.push(`[图片删除失败] ${errMsg}`)
              }
            }
            deleteLog.push(`[图片统计] 成功删除: ${deletedImageCount}/${allImageUrls.length}`)

            await prisma.$disconnect()

            const { default: Database } = await import('better-sqlite3');
            db = Database('./prisma/dev.db');

            db.pragma('foreign_keys = OFF');

            const deleteStmt = db.transaction(() => {
              deleteLog.push('[开始数据库删除]')

              const memoryCount = db.prepare('DELETE FROM Memory WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - Memory: ${memoryCount} 条`)

              const memorySummaryCount = db.prepare('DELETE FROM MemorySummary WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - MemorySummary: ${memorySummaryCount} 条`)

              const observationCount = db.prepare('DELETE FROM Observation WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - Observation: ${observationCount} 条`)

              const reflectionCount = db.prepare('DELETE FROM Reflection WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - Reflection: ${reflectionCount} 条`)

              const chatMessageCount = db.prepare('DELETE FROM ChatMessage WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - ChatMessage: ${chatMessageCount} 条`)

              const chatSessionCount = db.prepare('DELETE FROM ChatSession WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - ChatSession: ${chatSessionCount} 条`)

              const plotPredictCount = db.prepare('DELETE FROM PlotPredict WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - PlotPredict: ${plotPredictCount} 条`)

              const townEventCount = db.prepare('DELETE FROM TownEvent WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - TownEvent: ${townEventCount} 条`)

              const townStatusCount = db.prepare('DELETE FROM TownStatus WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - TownStatus: ${townStatusCount} 条`)

              const plotCount = db.prepare('DELETE FROM Plot WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - Plot: ${plotCount} 条`)

              const sceneCount = db.prepare('DELETE FROM Scene WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - Scene: ${sceneCount} 条`)

              const characterCount = db.prepare('DELETE FROM Character WHERE novelId = ?').run(id).changes;
              deleteLog.push(`  - Character: ${characterCount} 条`)

              const novelCount = db.prepare('DELETE FROM Novel WHERE id = ?').run(id).changes;
              deleteLog.push(`  - Novel: ${novelCount} 条`)

              deleteLog.push('[数据库删除完成]')
            });

            try {
              deleteStmt();
            } catch (txErr) {
              deleteLog.push(`[事务失败] ${txErr}`)
              throw txErr;
            }

            db.pragma('foreign_keys = ON');
            db.close();

            const elapsed = Date.now() - startTime
            deleteLog.push(`[删除完成] 耗时: ${elapsed}ms`)

            console.log('========== 删除日志 ==========')
            deleteLog.forEach(log => console.log(log))
            console.log('==============================')

            const response: { code: number; message: string; data: { elapsed: number; deletedImages: number; log: string[]; errors: string[] } } = {
              code: 200,
              message: '删除成功',
              data: {
                elapsed,
                deletedImages: deletedImageCount,
                log: deleteLog,
                errors: imageDeleteErrors
              }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(response))
          } catch (err: ApiError) {
            deleteLog.push(`[删除失败] ${err.message}`)

            if (db) {
              try { db.pragma('foreign_keys = ON'); } catch (_e) { /* ignore close error */ }
              try { db.close(); } catch (_e) { /* ignore close error */ }
            }

            console.error('========== 删除失败日志 ==========')
            deleteLog.forEach(log => console.error(log))
            console.error('===================================')

            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 500,
              message: '删除失败: ' + err.message,
              data: { log: deleteLog, errors: imageDeleteErrors }
            }))
          }
          return
        }

        // POST /novel/:id/parse
        if (path.match(/^\/api\/novel\/\d+\/parse$/) && req.method === 'POST') {
          const id = parseInt(path.split('/')[3])
          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const novel = await prisma.novel.findUnique({ where: { id } })
          if (!novel) {
            await prisma.$disconnect()
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 404, message: '小说不存在'
            }))
            return
          }

          await prisma.novel.update({
            where: { id },
            data: { parseStatus: 'PARSING' }
          })

          try {
            const { analyzeNovel } = await import('./utils/llm/index')
            const analysisResult = await analyzeNovel(novel)
            const characters = analysisResult.characters || []
            const scenes = analysisResult.scenes || []
            const plots = analysisResult.plots || []

            console.log('解析结果 - 角色数:', characters.length)
            console.log('解析结果 - 场景数:', scenes.length)
            console.log('解析结果 - 场景列表:', scenes)

            const createdCharacters: { id: number; name: string }[] = []

            for (const char of characters) {
              const character = await prisma.character.create({
                data: {
                  novelId: id,
                  name: char.name || '',
                  avatarUrl: char.avatarUrl || '',
                  description: char.description || '',
                  plotSetting: char.plotSetting || '',
                  relationships: JSON.stringify(char.relationships || []),
                  出场情节: char.出场情节 || '',
                  coreIdentity: char.coreIdentity || '',
                  classicLines: char.classicLines ? JSON.stringify(char.classicLines) : '[]'
                }
              })

              createdCharacters.push({ id: character.id, name: character.name })

              if (char.memories && char.memories.length > 0) {
                for (let i = 0; i < char.memories.length; i++) {
                  await prisma.memory.create({
                    data: {
                      characterId: character.id,
                      novelId: id,
                      content: char.memories[i],
                      type: 'PLOT',
                      importance: i < 3 ? 8 : 5,
                      tags: JSON.stringify(['小说情节', '原始记忆']),
                      source: 'manual',
                      timestamp: new Date()
                    }
                  })
                }
              }
            }

            for (let si = 0; si < scenes.length; si++) {
              const scene = scenes[si]
              const cols = Math.ceil(Math.sqrt(scenes.length))
              const col = si % cols
              const row = Math.floor(si / cols)
              const offsetX = (row % 2) * 110
              await prisma.scene.create({
                data: {
                  novelId: id,
                  name: scene.name || '',
                  description: scene.description || '',
                  type: scene.type || 'public',
                  positionX: col * 220 + offsetX + 100,
                  positionY: row * 200 + 100
                }
              })
            }

            const characterNameToId = new Map(createdCharacters.map(c => [c.name, c.id]))

            for (const plot of plots) {
              const involvedCharacterIds = (plot.involvedCharacterNames || [])
                .map((name: string) => characterNameToId.get(name))
                .filter((id: number | undefined): id is number => id !== undefined)

              await prisma.plot.create({
                data: {
                  novelId: id,
                  chapterIndex: plot.chapterIndex || 0,
                  sceneIndex: plot.sceneIndex || 0,
                  title: plot.title || '',
                  content: plot.content || '',
                  involvedCharacterIds: JSON.stringify(involvedCharacterIds),
                  dialogueContent: JSON.stringify(plot.dialogueContent || []),
                  narrationContent: plot.narrationContent || '',
                  location: plot.location || '',
                  isCompleted: false
                }
              })

              // 为每个参与情节的角色创建记忆
              for (const charId of involvedCharacterIds) {
                let memoryContent = ''

                // 构建记忆内容
                if (plot.narrationContent) {
                  memoryContent += plot.narrationContent + ' '
                }
                if (plot.dialogueContent && plot.dialogueContent.length > 0) {
                  memoryContent += plot.dialogueContent.join(' ')
                }

                if (memoryContent.trim()) {
                  await prisma.memory.create({
                    data: {
                      characterId: charId,
                      novelId: id,
                      content: `【${plot.title}】${memoryContent.trim()}`,
                      type: 'PLOT',
                      importance: plot.sceneIndex < 3 ? 8 : 6,
                      tags: JSON.stringify(['小说情节', `第${plot.chapterIndex}章第${plot.sceneIndex}节`]),
                      source: 'manual',
                      timestamp: new Date()
                    }
                  })
                }
              }
            }

            await prisma.novel.update({
              where: { id },
              data: { parseStatus: 'PARSED' }
            })

            try {
              const { generateAllImages } = await import('./utils/image-gen/index')
              const dbScenes = await prisma.scene.findMany({ where: { novelId: id, isActive: true } })
              const dbCharacters = await prisma.character.findMany({ where: { novelId: id } })

              console.log('开始为小说生成图片，场景数:', dbScenes.length, '角色数:', dbCharacters.length)

              const imageResults = await generateAllImages(
                dbScenes.map(s => ({ name: s.name, description: s.description || '', type: s.type })),
                dbCharacters.map(c => ({ name: c.name, description: c.description }))
              )

              for (let i = 0; i < imageResults.scenes.length && i < dbScenes.length; i++) {
                const r = imageResults.scenes[i]
                if (r.result.success && r.result.imageUrl) {
                  await prisma.scene.update({
                    where: { id: dbScenes[i].id },
                    data: { imageUrl: r.result.imageUrl, imagePrompt: r.result.prompt }
                  })
                }
              }

              for (let i = 0; i < imageResults.characters.length && i < dbCharacters.length; i++) {
                const r = imageResults.characters[i]
                if (r.result.success && r.result.imageUrl) {
                  await prisma.character.update({
                    where: { id: dbCharacters[i].id },
                    data: { imageUrl: r.result.imageUrl, imagePrompt: r.result.prompt }
                  })
                }
              }

              console.log('图片生成完成')
            } catch (imgErr: ApiError) {
              console.error('图片生成失败（不影响解析结果）:', imgErr.message)
            }

            // 修复：返回数据库中已更新图片的角色数据，而非LLM解析的原始数据
            const dbCharactersForResponse = await prisma.character.findMany({ where: { novelId: id } })

            await prisma.$disconnect()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: 200, message: '解析成功', data: { characters: dbCharactersForResponse, plots } }))
            return
          } catch (llmError: ApiError) {
            console.error('LLM解析失败:', llmError)
            await prisma.novel.update({
              where: { id },
              data: { parseStatus: 'FAILED' }
            })
            await prisma.$disconnect()
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: 500, message: '解析失败: ' + llmError.message }))
            return
          }
        }

        // GET /novel/:id/plots - 获取小说情节列表
        if (path.match(/^\/api\/novel\/\d+\/plots$/) && req.method === 'GET') {
          const novelId = parseInt(path.split('/')[3])
          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const novel = await prisma.novel.findUnique({ where: { id: novelId } })
          if (!novel) {
            await prisma.$disconnect()
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 404, message: '小说不存在'
            }))
            return
          }

          const plots = await prisma.plot.findMany({
            where: { novelId },
            orderBy: [
              { chapterIndex: 'asc' },
              { sceneIndex: 'asc' }
            ]
          })

          const characters = await prisma.character.findMany({
            where: { novelId },
            select: { id: true, name: true }
          })

          const characterMap = new Map(characters.map(c => [c.id, c.name]))

          const formattedPlots = plots.map(plot => {
            let involvedCharacterIds: number[] = []
            try {
              involvedCharacterIds = JSON.parse(plot.involvedCharacterIds)
            } catch (_e) { /* ignore parse error */ }

            let dialogueContent: string[] = []
            try {
              dialogueContent = JSON.parse(plot.dialogueContent)
            } catch (_e) { /* ignore parse error */ }

            return {
              id: plot.id,
              chapterIndex: plot.chapterIndex,
              sceneIndex: plot.sceneIndex,
              title: plot.title,
              content: plot.content,
              involvedCharacterIds,
              involvedCharacterNames: involvedCharacterIds.map(id => characterMap.get(id) || '未知'),
              dialogueContent,
              narrationContent: plot.narrationContent,
              location: plot.location,
              isCompleted: plot.isCompleted,
              completedAt: plot.completedAt
            }
          })

          const currentPlot = plots.find(p => !p.isCompleted)
          const completedCount = plots.filter(p => p.isCompleted).length

          await prisma.$disconnect()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: {
              total: plots.length,
              completed: completedCount,
              currentPlotId: currentPlot?.id || null,
              plots: formattedPlots
            }
          }))
          return
        }

        // PATCH /novel/:id/plots - 更新情节状态
        if (path.match(/^\/api\/novel\/\d+\/plots$/) && req.method === 'PATCH') {
          const novelId = parseInt(path.split('/')[3])

          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { plotId, action } = data

              if (!plotId || !action) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ code: 400, message: '缺少必要参数' }))
                return
              }

              const { PrismaClient } = await import('@prisma/client')
              const prisma = new PrismaClient()

              const plot = await prisma.plot.findFirst({
                where: { id: plotId, novelId }
              })

              if (!plot) {
                await prisma.$disconnect()
                res.writeHead(404, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                  code: 404, message: '情节不存在'
                }))
                return
              }

              if (action === 'complete') {
                await prisma.plot.update({
                  where: { id: plotId },
                  data: { isCompleted: true, completedAt: new Date() }
                })
              } else if (action === 'reset') {
                await prisma.plot.update({
                  where: { id: plotId },
                  data: { isCompleted: false, completedAt: null }
                })
              } else if (action === 'reset-all') {
                await prisma.plot.updateMany({
                  where: { novelId },
                  data: { isCompleted: false, completedAt: null }
                })
              }

              await prisma.$disconnect()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 200, message: '操作成功' }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '操作失败: ' + err.message }))
            }
          })
          return
        }

        // GET /character/:id - 获取角色详情
        if (path.match(/^\/api\/character\/\d+$/) && req.method === 'GET') {
          const id = parseInt(path.split('/')[3])

          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const character = await prisma.character.findUnique({ where: { id } })

          await prisma.$disconnect()

          if (character) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: 200, data: character }))
            return
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 404, message: '角色不存在'
            }))
            return
          }
        }

        // GET /town/:id/data
        if (path.match(/^\/api\/town\/\d+\/data$/) && req.method === 'GET') {
          const novelId = parseInt(path.split('/')[3])

          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const novel = await prisma.novel.findUnique({ where: { id: novelId } })
          const characters = await prisma.character.findMany({ where: { novelId } })
          const scenes = await prisma.scene.findMany({ where: { novelId, isActive: true } })

          console.log('小镇数据 - 场景数:', scenes.length)
          console.log('小镇数据 - 场景列表:', scenes)

          await prisma.$disconnect()

          if (!novel) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 404, message: '小说不存在'
            }))
            return
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: {
              novel: { id: novel.id, title: novel.title, author: novel.author },
              characters: characters.map(c => ({
                id: c.id,
                name: c.name,
                avatarUrl: c.avatarUrl,
                description: c.description,
                plotSetting: c.plotSetting,
                currentScene: c.currentScene || '待分配',
                isOnline: true
              })),
              scenes: scenes.length > 0 ? scenes.map(s => ({
                id: s.id,
                name: s.name,
                nameEn: s.name,
                type: s.type,
                description: s.description || '',
                characters: []
              })) : [
                { id: 1, name: '小镇广场', nameEn: 'Town Square', type: 'public', description: '小镇的中心广场', characters: [] },
                { id: 2, name: '幸福咖啡馆', nameEn: 'Happy Cafe', type: 'shop', description: '温馨的咖啡馆', characters: [] },
                { id: 3, name: '星光公园', nameEn: 'Starlight Park', type: 'park', description: '美丽的公园', characters: [] }
              ],
              events: []
            }
          }))
          return
        }

        // GET /town/:novelId/events
        if (path.match(/^\/api\/town\/\d+\/events$/) && req.method === 'GET') {
          const novelId = parseInt(path.split('/')[3])
          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const events = await prisma.townEvent.findMany({
            where: { novelId },
            orderBy: { timestamp: 'desc' },
            take: 50
          })

          await prisma.$disconnect()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code: 200, data: events }))
          return
        }

        // POST /town/:novelId/events
        if (path.match(/^\/api\/town\/\d+\/events$/) && req.method === 'POST') {
          const novelId = parseInt(path.split('/')[3])

          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { characterId, characterName, type, content } = data

              const { PrismaClient } = await import('@prisma/client')
              const prisma = new PrismaClient()

              const event = await prisma.townEvent.create({
                data: {
                  novelId,
                  characterId: characterId || 0,
                  type: type || 'message',
                  content: content || '',
                  timestamp: new Date(),
                  isRead: false
                }
              })

              await prisma.$disconnect()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 200, data: event }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '创建事件失败: ' + err.message }))
            }
          })
          return
        }

        // GET /town/:novelId/status
        if (path.match(/^\/api\/town\/\d+\/status$/) && req.method === 'GET') {
          const novelId = parseInt(path.split('/')[3])
          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          let status = await prisma.townStatus.findUnique({
            where: { novelId }
          })

          if (!status) {
            status = await prisma.townStatus.create({
              data: {
                novelId,
                isRunning: false,
                speed: 1,
                currentTime: new Date()
              }
            })
          }

          await prisma.$disconnect()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code: 200, data: status }))
          return
        }

        // PUT /town/:novelId/status
        if (path.match(/^\/api\/town\/\d+\/status$/) && req.method === 'PUT') {
          const novelId = parseInt(path.split('/')[3])

          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { isRunning, speed, currentTime } = data

              const { PrismaClient } = await import('@prisma/client')
              const prisma = new PrismaClient()

              const status = await prisma.townStatus.upsert({
                where: { novelId },
                update: {
                  isRunning: isRunning ?? undefined,
                  speed: speed ?? undefined,
                  currentTime: currentTime ? new Date(currentTime) : undefined,
                  lastUpdateTime: new Date()
                },
                create: {
                  novelId,
                  isRunning: isRunning ?? false,
                  speed: speed ?? 1,
                  currentTime: currentTime ? new Date(currentTime) : new Date()
                }
              })

              if (isRunning) {
                const { startTownSimulation } = await import('./utils/agent/town')
                await startTownSimulation(prisma, novelId, speed || 1)
                console.log(`小镇模拟已启动: novelId=${novelId}, speed=${speed}`)
              } else {
                const { stopTownSimulation } = await import('./utils/agent/town')
                stopTownSimulation()
                console.log(`小镇模拟已停止`)
              }

              await prisma.$disconnect()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 200, data: status }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '更新状态失败: ' + err.message }))
            }
          })
          return
        }

        // POST /town/:novelId/command
        if (path.match(/^\/api\/town\/\d+\/command$/) && req.method === 'POST') {
          const novelId = parseInt(path.split('/')[3])

          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { command } = data

              const { PrismaClient } = await import('@prisma/client')
              const prisma = new PrismaClient()

              await prisma.townEvent.create({
                data: {
                  novelId,
                  characterId: 0,
                  type: 'message',
                  content: `执行指令: ${command}`,
                  timestamp: new Date(),
                  isRead: true
                }
              })

              await prisma.$disconnect()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                code: 200, message: '指令已接收'
              }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '执行指令失败: ' + err.message }))
            }
          })
          return
        }

        // POST /character/:id/chat - 角色智能对话
        if (path.match(/^\/api\/character\/\d+\/chat$/) && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', async () => {
            try {
              const { message, history, novelId } = JSON.parse(body)
              const characterId = parseInt(path.split('/')[3])

              const { PrismaClient } = await import('@prisma/client')
              const prisma = new PrismaClient()

              const character = await prisma.character.findUnique({ where: { id: characterId } })

              if (!character) {
                await prisma.$disconnect()
                res.writeHead(404, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                  code: 404, message: '角色不存在'
                }))
                return
              }

              const { generateCharacterResponse } = await import('./utils/llm/index')

              // 获取角色的记忆（包括重要记忆和最近记忆）
              const [importantMemories, recentMemories] = await Promise.all([
                prisma.memory.findMany({
                  where: { characterId, importance: { gte: 7 }, isArchived: false },
                  orderBy: { timestamp: 'desc' },
                  take: 10
                }),
                prisma.memory.findMany({
                  where: { characterId, isArchived: false },
                  orderBy: { timestamp: 'desc' },
                  take: 10
                })
              ])

              // 合并记忆，去重
              const memoriesMap = new Map()
              recentMemories.forEach(m => memoriesMap.set(m.id, m))
              importantMemories.forEach(m => memoriesMap.set(m.id, m))
              const allMemories = Array.from(memoriesMap.values())

              const characterWithMemories = {
                ...character,
                memories: allMemories
              }

              const historyMessages = history?.map((h: any) => ({
                role: h.isMe ? 'user' as const : 'assistant' as const,
                content: h.content
              })) || []

              const response = await generateCharacterResponse(
                characterWithMemories,
                message,
                historyMessages
              )

              // 保存聊天记录到数据库
              if (novelId) {
                // 保存用户消息
                await prisma.chatMessage.create({
                  data: {
                    novelId: novelId,
                    senderType: 'user',
                    senderId: 0,
                    receiverId: characterId,
                    content: message,
                    sendTime: new Date(),
                    sessionId: null
                  }
                })
                // 保存AI回复
                await prisma.chatMessage.create({
                  data: {
                    novelId: novelId,
                    senderType: 'character',
                    senderId: characterId,
                    receiverId: 0,
                    content: response,
                    sendTime: new Date(),
                    sessionId: null
                  }
                })

                // 将用户的消息保存为角色的记忆
                await prisma.memory.create({
                  data: {
                    characterId,
                    novelId,
                    content: `用户对我说：${message}`,
                    type: 'DIALOGUE',
                    importance: 6,
                    tags: JSON.stringify(['私聊', '用户对话']),
                    source: 'manual',
                    timestamp: new Date()
                  }
                })

                await prisma.memory.create({
                  data: {
                    characterId,
                    novelId,
                    content: `我对用户说：${response}`,
                    type: 'DIALOGUE',
                    importance: 6,
                    tags: JSON.stringify(['私聊', '角色对话']),
                    source: 'manual',
                    timestamp: new Date()
                  }
                })
              }

              await prisma.$disconnect()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 200, data: { response } }))
            } catch (err: ApiError) {
              console.error('对话生成失败:', err)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '对话生成失败: ' + err.message }))
            }
          })
          return
        }

        // GET /character/:id/chat-history - 获取角色聊天记录
        if (path.match(/^\/api\/character\/\d+\/chat-history$/) && req.method === 'GET') {
          const characterId = parseInt(path.split('/')[3])
          const urlObj = new URL(url, 'http://localhost')
          const novelId = parseInt(urlObj.searchParams.get('novelId') || '0')

          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const messages = await prisma.chatMessage.findMany({
            where: {
              novelId,
              OR: [
                { senderId: characterId },
                { receiverId: characterId }
              ]
            },
            orderBy: { sendTime: 'asc' },
            take: 100
          })

          await prisma.$disconnect()

          const formattedMessages = messages.map(m => ({
            id: m.id,
            senderId: m.senderId,
            senderName: m.senderType === 'user' ? '我' : '角色',
            content: m.content,
            timestamp: m.sendTime.toISOString(),
            isMe: m.senderType === 'user'
          }))

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code: 200, data: formattedMessages }))
          return
        }

        // GET /character/:id/memory/stats - 获取记忆统计
        if (path.match(/^\/api\/character\/\d+\/memory\/stats$/) && req.method === 'GET') {
          const id = parseInt(path.split('/')[3])

          const { memory } = await import('./utils/memory')

          const stats = await memory.getMemoryStats(id)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: stats
          }))
          return
        }

        // GET /character/:id/memory/important - 获取重要记忆
        if (path.match(/^\/api\/character\/\d+\/memory\/important$/) && req.method === 'GET') {
          const id = parseInt(path.split('/')[3])
          const urlObj = new URL(url, 'http://localhost')
          const minImportance = parseInt(urlObj.searchParams.get('minImportance') || '7')
          const limit = parseInt(urlObj.searchParams.get('limit') || '20')

          const { memory } = await import('./utils/memory')

          const importantMemories = await memory.getImportantMemories(id, minImportance, limit)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: {
              list: importantMemories.map(m => ({
                id: m.id,
                content: m.content,
                type: m.type,
                importance: m.importance,
                tags: JSON.parse(m.tags || '[]'),
                timestamp: m.timestamp,
                createdAt: m.createdAt
              })),
              count: importantMemories.length
            }
          }))
          return
        }

        // GET /character/:id/memory/recent - 获取最近记忆
        if (path.match(/^\/api\/character\/\d+\/memory\/recent$/) && req.method === 'GET') {
          const id = parseInt(path.split('/')[3])
          const urlObj = new URL(url, 'http://localhost')
          const hours = parseInt(urlObj.searchParams.get('hours') || '24')
          const limit = parseInt(urlObj.searchParams.get('limit') || '20')

          const { memory } = await import('./utils/memory')

          const recentMemories = await memory.getRecentMemories(id, hours, limit)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: {
              list: recentMemories.map(m => ({
                id: m.id,
                content: m.content,
                type: m.type,
                importance: m.importance,
                timestamp: m.timestamp,
                createdAt: m.createdAt
              })),
              count: recentMemories.length
            }
          }))
          return
        }

        // POST /character/:id/memory/search - 搜索记忆
        if (path.match(/^\/api\/character\/\d+\/memory\/search$/) && req.method === 'POST') {
          const id = parseInt(path.split('/')[3])

          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { query, limit } = data

              if (!query) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ code: 400, message: '请提供搜索关键词' }))
                return
              }

              const { memory } = await import('./utils/memory')
              const results = await memory.searchMemories(id, query, limit || 20)

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                code: 200,
                data: {
                  list: results.map(m => ({
                    id: m.id,
                    content: m.content,
                    type: m.type,
                    importance: m.importance,
                    timestamp: m.timestamp
                  })),
                  count: results.length
                }
              }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '搜索失败: ' + err.message }))
            }
          })
          return
        }

        // GET /character/:id/memory - 获取角色记忆列表
        if (path.match(/^\/api\/character\/\d+\/memory$/) && req.method === 'GET') {
          const id = parseInt(path.split('/')[3])
          const urlObj = new URL(url, 'http://localhost')
          const page = parseInt(urlObj.searchParams.get('page') || '1')
          const pageSize = parseInt(urlObj.searchParams.get('pageSize') || '20')
          const type = urlObj.searchParams.get('type') || undefined

          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const character = await prisma.character.findUnique({ where: { id } })
          if (!character) {
            await prisma.$disconnect()
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 404, message: '角色不存在'
            }))
            return
          }

          const where: Record<string, unknown> = { characterId: id }
          if (type) {
            where.type = type
          }

          const [memories, total] = await Promise.all([
            prisma.memory.findMany({
              where,
              orderBy: { timestamp: 'desc' },
              skip: (page - 1) * pageSize,
              take: pageSize
            }),
            prisma.memory.count({ where })
          ])

          await prisma.$disconnect()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: {
              list: memories.map(m => ({
                id: m.id,
                content: m.content,
                type: m.type,
                importance: m.importance,
                tags: JSON.parse(m.tags || '[]'),
                timestamp: m.timestamp,
                createdAt: m.createdAt
              })),
              pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
              }
            }
          }))
          return
        }

        // POST /character/:id/init-memory - 初始化角色记忆
        if (path.match(/^\/api\/character\/\d+\/init-memory$/) && req.method === 'POST') {
          const id = parseInt(path.split('/')[3])

          const { memory } = await import('./utils/memory')

          const mem = await memory.getMemories(id, { limit: 1 })
          if (mem.length > 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: 400, message: '该角色已有初始记忆，如需重新生成请先删除现有记忆' }))
            return
          }

          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()
          const character = await prisma.character.findUnique({ where: { id } })
          await prisma.$disconnect()

          if (!character) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 404, message: '角色不存在'
            }))
            return
          }

          const initialMemory = await memory.writeMemory({
            characterId: id,
            novelId: character.novelId,
            content: `${character.name}的核心人设：${character.description}。角色背景：${character.plotSetting}。人际关系：${character.relationships}。`,
            type: 'OBSERVATION',
            importance: 10,
            tags: ['初始记忆', '人设', '核心'],
            source: 'manual'
          })

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            message: '初始记忆生成成功',
            data: {
              count: 1,
              memory: {
                id: initialMemory.id,
                content: initialMemory.content,
                type: initialMemory.type,
                importance: initialMemory.importance
              }
            }
          }))
          return
        }

        // POST /character/:id/reflect - 生成角色反思
        if (path.match(/^\/api\/character\/\d+\/reflect$/) && req.method === 'POST') {
          const id = parseInt(path.split('/')[3])

          const { memory } = await import('./utils/memory')

          const mems = await memory.getMemories(id, { limit: 1 })
          if (mems.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: 400, message: '角色还没有记忆，请先创建记忆' }))
            return
          }

          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()
          const character = await prisma.character.findUnique({ where: { id } })
          await prisma.$disconnect()

          if (!character) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 404, message: '角色不存在'
            }))
            return
          }

          try {
            const reflections = await memory.generateReflection(id, character.novelId)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 200,
              message: '反思生成成功',
              data: {
                count: reflections.length,
                reflections: reflections.map(r => ({
                  id: r.id,
                  content: r.content,
                  type: r.type,
                  importance: r.importance,
                  timestamp: r.timestamp
                }))
              }
            }))
          } catch (error: ApiError) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 400, message: error.message || '生成反思失败'
            }))
          }
          return
        }

        // GET /character/:id/reflections - 获取反思历史
        if (path.match(/^\/api\/character\/\d+\/reflections$/) && req.method === 'GET') {
          const id = parseInt(path.split('/')[3])
          const urlObj = new URL(url, 'http://localhost')
          const limit = parseInt(urlObj.searchParams.get('limit') || '10')

          const { memory } = await import('./utils/memory')

          const reflections = await memory.getReflections(id, limit)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: {
              list: reflections.map(r => ({
                id: r.id,
                content: r.content,
                triggerEvent: r.triggerEvent,
                importance: r.importance,
                isActive: r.isActive,
                createdAt: r.createdAt
              })),
              count: reflections.length
            }
          }))
          return
        }

        // GET /api/town/:novelId/scene/:sceneId/sessions
        if (path.match(/^\/api\/town\/\d+\/scene\/\d+\/sessions$/) && req.method === 'GET') {
          const novelId = parseInt(path.split('/')[3])
          const sceneId = parseInt(path.split('/')[5])

          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          // 获取该场景的公共聊天，如果没有则创建
          let publicSession = await prisma.chatSession.findFirst({
            where: { novelId, sceneId, type: 'public' }
          })

          if (!publicSession) {
            publicSession = await prisma.chatSession.create({
              data: {
                novelId,
                sceneId,
                name: '公共聊天',
                type: 'public',
                lastMessageTime: new Date()
              }
            })
          }

          // 获取该场景的群聊
          const groupSessions = await prisma.chatSession.findMany({
            where: { novelId, sceneId, type: 'group' },
            orderBy: { lastMessageTime: 'desc' }
          })

          await prisma.$disconnect()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code: 200, data: [publicSession, ...groupSessions] }))
          return
        }

        // POST /api/town/:novelId/scene/:sceneId/sessions
        if (path.match(/^\/api\/town\/\d+\/scene\/\d+\/sessions$/) && req.method === 'POST') {
          const novelId = parseInt(path.split('/')[3])
          const sceneId = parseInt(path.split('/')[5])

          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { name, participantIds } = data

              const { PrismaClient } = await import('@prisma/client')
              const prisma = new PrismaClient()

              const session = await prisma.chatSession.create({
                data: {
                  novelId,
                  sceneId,
                  name: name || '群聊',
                  type: 'group',
                  participantIds: JSON.stringify(participantIds || []),
                  lastMessageTime: new Date()
                }
              })

              await prisma.$disconnect()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 200, data: session }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '创建群聊失败: ' + err.message }))
            }
          })
          return
        }

        // GET /api/session/:sessionId/messages
        if (path.match(/^\/api\/session\/\d+\/messages$/) && req.method === 'GET') {
          const sessionId = parseInt(path.split('/')[3])

          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const messages = await prisma.chatMessage.findMany({
            where: { sessionId },
            orderBy: { sendTime: 'asc' },
            take: 100
          })

          // 为了前端显示，获取角色信息
          const characterIds = messages.filter(m => m.senderType === 'character').map(m => m.senderId)
          const characters = await prisma.character.findMany({
            where: { id: { in: characterIds } }
          })
          const charMap = new Map(characters.map(c => [c.id, c]))

          const formattedMessages = messages.map(m => {
            const isMe = m.senderType === 'user'
            const char = !isMe ? charMap.get(m.senderId) : null
            return {
              id: m.id,
              senderId: m.senderId,
              senderName: isMe ? '我' : (char?.name || '未知角色'),
              senderAvatar: char?.avatarUrl || undefined,
              content: m.content,
              timestamp: m.sendTime.toISOString(),
              isMe
            }
          })

          await prisma.$disconnect()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code: 200, data: formattedMessages }))
          return
        }

        // POST /api/scene/chat - 场景聊天，角色根据记忆流生成回复
        if (path === '/api/scene/chat' && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { characterId, sceneName, context, sessionId, novelId, userMessage } = data

              if (!characterId) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ code: 400, message: '缺少角色ID' }))
                return
              }

              const { PrismaClient } = await import('@prisma/client')
              const prisma = new PrismaClient()

              // 如果传入了用户消息和会话ID，则先保存用户消息
              if (userMessage && sessionId && novelId) {
                await prisma.chatMessage.create({
                  data: {
                    novelId: Number(novelId),
                    sessionId: Number(sessionId),
                    senderType: 'user',
                    senderId: 0,
                    receiverId: 0,
                    content: userMessage,
                    sendTime: new Date()
                  }
                })
              }

              const character = await prisma.character.findUnique({
                where: { id: characterId }
              })

              if (!character) {
                await prisma.$disconnect()
                res.writeHead(404, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                  code: 404, message: '角色不存在'
                }))
                return
              }

              // 提取角色的重要记忆和最近记忆作为上下文
              const [importantMemories, recentMemories] = await Promise.all([
                prisma.memory.findMany({
                  where: { characterId, importance: { gte: 7 }, isArchived: false },
                  orderBy: { timestamp: 'desc' },
                  take: 10
                }),
                prisma.memory.findMany({
                  where: { characterId, isArchived: false },
                  orderBy: { timestamp: 'desc' },
                  take: 10
                })
              ])

              // 合并记忆，去重
              const memoriesMap = new Map()
              recentMemories.forEach(m => memoriesMap.set(m.id, m))
              importantMemories.forEach(m => memoriesMap.set(m.id, m))
              const allMemories = Array.from(memoriesMap.values())

              const { generateCharacterResponse } = await import('./utils/llm/index')

              const contextMessages = context && context.length > 0
                ? context.map((m: any) => `${m.senderName}说：${m.content}`).join('\n')
                : '当前场景很安静，没有人说太多话'

              // 修改Prompt，强调让角色根据记忆流回复
              const userPrompt = `当前场景：${sceneName || '未知场景'}
                对话上下文：
${contextMessages}

【重要指令】：请结合你自己的“角色设定”以及“你的记忆”，像真实人物一样参与到上面的对话中。如果别人的对话问到了你记忆中的事情，请一定要根据记忆来回答！
作为${character.name}，你应该回复什么？
  只需要输出角色说的话，不需要描述动作或表情。`

              const response = await generateCharacterResponse(
                {
                  ...character,
                  memories: allMemories
                },
                userPrompt,
                [] // 不再重复传入历史，因为上下文已经包含在userPrompt中
              )

              // 保存AI的回复
              if (sessionId && novelId) {
                await prisma.chatMessage.create({
                  data: {
                    novelId: Number(novelId),
                    sessionId: Number(sessionId),
                    senderType: 'character',
                    senderId: characterId,
                    receiverId: 0,
                    content: response,
                    sendTime: new Date()
                  }
                })

                await prisma.chatSession.update({
                  where: { id: Number(sessionId) },
                  data: { lastMessageTime: new Date() }
                })
              }

              await prisma.$disconnect()

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                code: 200,
                data: {
                  content: response,
                  characterId: character.id,
                  characterName: character.name
                }
              }))
            } catch (error: any) {
              console.error('场景聊天生成失败:', error)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: error.message || '生成回复失败' }))
            }
          })
          return
        }

        // GET /character/:id/observations - 获取观察记录
        if (path.match(/^\/api\/character\/\d+\/observations$/) && req.method === 'GET') {
          const id = parseInt(path.split('/')[3])
          const urlObj = new URL(url, 'http://localhost')
          const limit = parseInt(urlObj.searchParams.get('limit') || '20')

          const { memory } = await import('./utils/memory')

          const observations = await memory.getObservations(id, limit)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: {
              list: observations.map(o => ({
                id: o.id,
                content: o.content,
                sourceType: o.sourceType,
                sourceName: o.sourceName,
                location: o.location,
                participants: JSON.parse(o.participants || '[]'),
                emotion: o.emotion,
                isImportant: o.isImportant,
                createdAt: o.createdAt
              })),
              count: observations.length
            }
          }))
          return
        }

        // POST /memory/write - 写入记忆
        if (path === '/api/memory/write' && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { characterId, novelId, content, type, importance, tags, location, participants, emotion } = data

              if (!characterId || !novelId || !content || !type) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ code: 400, message: '缺少必要的参数：characterId、novelId、content、type' }))
                return
              }

              const validTypes = ['OBSERVATION', 'DIALOGUE', 'REFLECTION', 'PLOT']
              if (!validTypes.includes(type)) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ code: 400, message: `无效的记忆类型，允许的类型：${validTypes.join(', ')} ` }))
                return
              }

              const { memory } = await import('./utils/memory')

              const memoryRecord = await memory.writeMemory({
                characterId,
                novelId,
                content,
                type,
                importance,
                tags,
                location,
                participants,
                emotion,
                source: 'manual'
              })

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                code: 200,
                message: '记忆写入成功',
                data: {
                  id: memoryRecord.id,
                  characterId: memoryRecord.characterId,
                  novelId: memoryRecord.novelId,
                  content: memoryRecord.content,
                  type: memoryRecord.type,
                  importance: memoryRecord.importance,
                  timestamp: memoryRecord.timestamp,
                  createdAt: memoryRecord.createdAt
                }
              }))
            } catch (err: ApiError) {
              console.error('写入记忆失败:', err)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '写入记忆失败: ' + err.message }))
            }
          })
          return
        }

        // DELETE /memory/:id - 删除记忆
        if (path.match(/^\/api\/memory\/\d+$/) && req.method === 'DELETE') {
          const id = parseInt(path.split('/')[2])

          const { memory } = await import('./utils/memory')

          try {
            await memory.deleteMemory(id)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: 200, message: '记忆删除成功' }))
          } catch (err: ApiError) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: 500, message: '删除记忆失败: ' + err.message }))
          }
          return
        }

        // PUT /memory/:id - 更新记忆
        if (path.match(/^\/api\/memory\/\d+$/) && req.method === 'PUT') {
          const id = parseInt(path.split('/')[2])

          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { content, importance, tags } = data

              const { memory } = await import('./utils/memory')

              const updated = await memory.updateMemory(id, {
                content,
                importance,
                tags
              })

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                code: 200,
                message: '记忆更新成功',
                data: {
                  id: updated.id,
                  content: updated.content,
                  importance: updated.importance,
                  tags: JSON.parse(updated.tags || '[]'),
                  updatedAt: updated.updatedAt
                }
              }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '更新记忆失败: ' + err.message }))
            }
          })
          return
        }

        // GET /api/image-gen/status
        if (path === '/api/image-gen/status' && req.method === 'GET') {
          const { getImageGenStatus } = await import('./utils/image-gen/index')
          const status = getImageGenStatus()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code: 200, data: status }))
          return
        }

        // POST /api/image-gen/scene
        if (path === '/api/image-gen/scene' && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const { sceneId, sceneName, sceneDescription, sceneType } = JSON.parse(body)

              const { generateSceneImage, buildScenePrompt } = await import('./utils/image-gen/index')
              const prompt = buildScenePrompt(sceneName || '', sceneDescription || '', sceneType || 'public')
              const result = await generateSceneImage(sceneName || '', sceneDescription || '', sceneType || 'public')

              if (result.success && sceneId) {
                const { PrismaClient } = await import('@prisma/client')
                const prisma = new PrismaClient()
                await prisma.scene.update({
                  where: { id: sceneId },
                  data: { imageUrl: result.imageUrl, imagePrompt: prompt }
                })
                await prisma.$disconnect()
              }

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 200, data: result }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '场景图片生成失败: ' + err.message }))
            }
          })
          return
        }

        // POST /api/image-gen/character
        if (path === '/api/image-gen/character' && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const { characterId, characterName, characterDescription } = JSON.parse(body)

              const { generateCharacterImage, buildCharacterPrompt } = await import('./utils/image-gen/index')
              const prompt = buildCharacterPrompt(characterName || '', characterDescription || '')
              const result = await generateCharacterImage(characterName || '', characterDescription || '')

              if (result.success && characterId) {
                const { PrismaClient } = await import('@prisma/client')
                const prisma = new PrismaClient()
                await prisma.character.update({
                  where: { id: characterId },
                  data: { imageUrl: result.imageUrl, imagePrompt: prompt }
                })
                await prisma.$disconnect()
              }

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 200, data: result }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '角色图片生成失败: ' + err.message }))
            }
          })
          return
        }

        // POST /api/image-gen/batch
        if (path === '/api/image-gen/batch' && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', async () => {
            try {
              const { novelId } = JSON.parse(body)

              if (!novelId) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ code: 400, message: '缺少 novelId' }))
                return
              }

              const { PrismaClient } = await import('@prisma/client')
              const prisma = new PrismaClient()

              const scenes = await prisma.scene.findMany({ where: { novelId, isActive: true } })
              const characters = await prisma.character.findMany({ where: { novelId } })

              const { generateAllImages } = await import('./utils/image-gen/index')
              const results = await generateAllImages(
                scenes.map(s => ({ name: s.name, description: s.description || '', type: s.type })),
                characters.map(c => ({ name: c.name, description: c.description }))
              )

              for (let i = 0; i < results.scenes.length && i < scenes.length; i++) {
                const r = results.scenes[i]
                if (r.result.success && r.result.imageUrl) {
                  await prisma.scene.update({
                    where: { id: scenes[i].id },
                    data: { imageUrl: r.result.imageUrl, imagePrompt: r.result.prompt }
                  })
                }
              }

              for (let i = 0; i < results.characters.length && i < characters.length; i++) {
                const r = results.characters[i]
                if (r.result.success && r.result.imageUrl) {
                  await prisma.character.update({
                    where: { id: characters[i].id },
                    data: { imageUrl: r.result.imageUrl, imagePrompt: r.result.prompt }
                  })
                }
              }

              await prisma.$disconnect()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 200, data: results }))
            } catch (err: ApiError) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: 500, message: '批量图片生成失败: ' + err.message }))
            }
          })
          return
        }

        // GET /api/town/:novelId/map-data
        if (path.match(/^\/api\/town\/\d+\/map-data$/) && req.method === 'GET') {
          const novelId = parseInt(path.split('/')[3])
          const { PrismaClient } = await import('@prisma/client')
          const prisma = new PrismaClient()

          const novel = await prisma.novel.findUnique({ where: { id: novelId } })
          if (!novel) {
            await prisma.$disconnect()
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              code: 404, message: '小说不存在'
            }))
            return
          }

          const scenes = await prisma.scene.findMany({ where: { novelId, isActive: true } })
          const characters = await prisma.character.findMany({ where: { novelId } })
          const events = await prisma.townEvent.findMany({
            where: { novelId },
            orderBy: { timestamp: 'desc' },
            take: 30
          })

          const needsLayout = scenes.length > 0 && scenes.every(s => s.positionX === 0 && s.positionY === 0)
          if (needsLayout) {
            const cols = Math.ceil(Math.sqrt(scenes.length))
            for (let i = 0; i < scenes.length; i++) {
              const col = i % cols
              const row = Math.floor(i / cols)
              const offsetX = (row % 2) * 110
              const posX = col * 220 + offsetX + 100
              const posY = row * 200 + 100
              await prisma.scene.update({
                where: { id: scenes[i].id },
                data: { positionX: posX, positionY: posY }
              })
              scenes[i].positionX = posX
              scenes[i].positionY = posY
            }
          }

          const sceneMap = new Map(scenes.map(s => [s.name, s]))

          const charactersWithScene = characters.map(c => {
            const currentScene = sceneMap.get(c.currentScene)
            return {
              id: c.id,
              name: c.name,
              avatarUrl: c.avatarUrl,
              imageUrl: c.imageUrl,
              description: c.description,
              plotSetting: c.plotSetting,
              currentScene: c.currentScene || '待分配',
              currentSceneId: currentScene?.id || null,
              positionX: currentScene?.positionX || 0,
              positionY: currentScene?.positionY || 0,
              isOnline: true
            }
          })

          await prisma.$disconnect()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            code: 200,
            data: {
              novel: { id: novel.id, title: novel.title, author: novel.author },
              scenes: scenes.map(s => ({
                id: s.id,
                name: s.name,
                type: s.type,
                description: s.description || '',
                positionX: s.positionX,
                positionY: s.positionY,
                imageUrl: s.imageUrl,
                imagePrompt: s.imagePrompt,
                mapStyle: s.mapStyle,
                characters: charactersWithScene.filter(c => c.currentScene === s.name)
              })),
              characters: charactersWithScene,
              events: events.map(e => ({
                id: e.id,
                characterId: e.characterId,
                characterName: e.characterName,
                type: e.type,
                content: e.content,
                timestamp: e.timestamp,
                isRead: e.isRead
              }))
            }
          }))
          return
        }

      } catch (err: ApiError) {
        console.error('API Error:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ code: 500, message: '服务器错误: ' + err.message }))
        return
      }
    }

    // 非 API 请求，交给 Vite 处理
    try {
      return await vite.middlewares(req, res, () => { })
    } catch (err: ApiError) {
      console.error('Vite Error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code: 500, message: 'Vite error: ' + err.message }))
    }
  }

  const server = createHttpServer(app)

  server.listen(5173, () => {
    console.log('\n==> Server running at http://localhost:5173\n')
  })
}

startServer().catch(console.error)
