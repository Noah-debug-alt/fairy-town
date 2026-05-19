import React, { useRef, useEffect, useState, useCallback } from 'react';

interface MapCharacter {
    id: number;
    name: string;
    avatarUrl: string | null;
    imageUrl: string | null;
    currentScene: string;
    currentSceneId: number | null;
    positionX: number;
    positionY: number;
    isOnline: boolean;
    description?: string;
    plotSetting?: string;
}

interface MapScene {
    id: number;
    name: string;
    type: string;
    description: string;
    positionX: number;
    positionY: number;
    imageUrl: string | null;
    imagePrompt: string | null;
    mapStyle: string;
    characters: MapCharacter[];
}

interface MapEvent {
    id: number;
    characterId: number | null;
    characterName: string | null;
    type: string;
    content: string;
    timestamp: string;
    isRead: boolean;
}

interface DialogueBubble {
    id: string;
    characterName: string;
    content: string;
    x: number;
    y: number;
    opacity: number;
    createdAt: number;
    color: string;
}

interface TownMapProps {
    scenes: MapScene[];
    characters: MapCharacter[];
    events: MapEvent[];
    onSceneClick?: (sceneId: number) => void;
    onCharacterClick?: (character: MapCharacter) => void;
    isRunning: boolean;
    speed: number;
}

const SCENE_COLORS: Record<string, { bg: string; border: string; roof: string; label: string }> = {
    public: { bg: '#E8F4FD', border: '#4A90D9', roof: '#2E6CB5', label: '广场' },
    shop: { bg: '#E8F8E8', border: '#52c41a', roof: '#389E0D', label: '商店' },
    park: { bg: '#E0F7FA', border: '#13c2c2', roof: '#00838F', label: '公园' },
    school: { bg: '#F3E5F5', border: '#722ed1', roof: '#4A148C', label: '学校' },
    hospital: { bg: '#FCE4EC', border: '#eb2f96', roof: '#AD1457', label: '医院' },
    home: { bg: '#FFF8E1', border: '#faad14', roof: '#F57F17', label: '住宅' },
    restaurant: { bg: '#FFEBEE', border: '#f5222d', roof: '#B71C1C', label: '餐厅' },
    library: { bg: '#E8EAF6', border: '#2f54eb', roof: '#1A237E', label: '图书馆' },
    forest: { bg: '#E8F5E9', border: '#389e0d', roof: '#1B5E20', label: '森林' },
    castle: { bg: '#F3E5F5', border: '#9254de', roof: '#6A1B9A', label: '城堡' },
    market: { bg: '#FFF3E0', border: '#fa8c16', roof: '#E65100', label: '市场' },
    bridge: { bg: '#ECEFF1', border: '#8c8c8c', roof: '#37474F', label: '桥梁' },
    lake: { bg: '#E1F5FE', border: '#1890ff', roof: '#01579B', label: '湖泊' },
    church: { bg: '#FFEBEE', border: '#cf1322', roof: '#7F0000', label: '教堂' },
    tavern: { bg: '#EFEBE9', border: '#ad6800', roof: '#4E342E', label: '酒馆' },
};

const BUILDING_WIDTH = 160;
const BUILDING_HEIGHT = 120;
const BUILDING_GAP_X = 60;
const BUILDING_GAP_Y = 80;
const CHARACTER_SIZE = 36;
const BUBBLE_DURATION = 8000;

function autoLayoutScenes(scenes: MapScene[]): MapScene[] {
    const hasPositions = scenes.some(s => s.positionX !== 0 || s.positionY !== 0);
    if (hasPositions) {
        return scenes.map(s => ({
            ...s,
            positionX: s.positionX || 0,
            positionY: s.positionY || 0,
        }));
    }

    const cols = Math.ceil(Math.sqrt(scenes.length));
    return scenes.map((scene, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const offsetX = (row % 2) * (BUILDING_WIDTH / 2 + BUILDING_GAP_X / 2);
        return {
            ...scene,
            positionX: col * (BUILDING_WIDTH + BUILDING_GAP_X) + offsetX + 100,
            positionY: row * (BUILDING_HEIGHT + BUILDING_GAP_Y) + 100,
        };
    });
}

function getCharacterPositionInScene(
    characterIndex: number,
    _totalCharacters: number,
    sceneX: number,
    sceneY: number
): { x: number; y: number } {
    const startX = sceneX + 20;
    const startY = sceneY + BUILDING_HEIGHT - 10;
    const maxPerRow = Math.max(1, Math.floor((BUILDING_WIDTH - 20) / (CHARACTER_SIZE + 4)));
    const row = Math.floor(characterIndex / maxPerRow);
    const col = characterIndex % maxPerRow;
    return {
        x: startX + col * (CHARACTER_SIZE + 4),
        y: startY + row * (CHARACTER_SIZE + 4),
    };
}

const TownMap: React.FC<TownMapProps> = ({
    scenes,
    characters,
    events,
    onSceneClick,
    onCharacterClick,
    isRunning,
    speed,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dialogueBubbles, setDialogueBubbles] = useState<DialogueBubble[]>([]);
    const [hoveredScene, setHoveredScene] = useState<number | null>(null);
    const [hoveredCharacter, setHoveredCharacter] = useState<number | null>(null);
    const [sceneImages, setSceneImages] = useState<Record<number, HTMLImageElement>>({});
    const [characterImages, setCharacterImages] = useState<Record<number, HTMLImageElement>>({});
    const lastEventIdRef = useRef<number>(0);
    const animFrameRef = useRef<number>(0);

    const layoutedScenes = autoLayoutScenes(scenes);

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setCanvasSize({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);

        // 使用ResizeObserver监听容器尺寸变化（侧边栏收起/展开时触发）
        let resizeObserver: ResizeObserver | null = null;
        if (containerRef.current && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                handleResize();
            });
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }, []);

    useEffect(() => {
        scenes.forEach(scene => {
            if (scene.imageUrl && !scene.imageUrl.startsWith('placeholder://') && !sceneImages[scene.id]) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    setSceneImages(prev => ({ ...prev, [scene.id]: img }));
                };
                img.src = scene.imageUrl;
            }
        });
    }, [scenes]);

    useEffect(() => {
        characters.forEach(char => {
            if (char.imageUrl && !char.imageUrl.startsWith('placeholder://') && !characterImages[char.id]) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    setCharacterImages(prev => ({ ...prev, [char.id]: img }));
                };
                img.src = char.imageUrl;
            }
        });
    }, [characters]);

    useEffect(() => {
        const newDialogueEvents = events.filter(
            e => e.id > lastEventIdRef.current &&
                (e.type === 'dialogue' || e.type === 'message') &&
                e.characterName &&
                e.content
        );

        if (newDialogueEvents.length > 0) {
            lastEventIdRef.current = Math.max(...newDialogueEvents.map(e => e.id));

            const newBubbles: DialogueBubble[] = newDialogueEvents.map(event => {
                const character = characters.find(c => c.name === event.characterName);
                const scene = layoutedScenes.find(s =>
                    s.characters.some(sc => sc.name === event.characterName)
                );

                let bubbleX = 200;
                let bubbleY = 200;
                if (scene) {
                    const charIdx = scene.characters.findIndex(c => c.name === event.characterName);
                    const charPos = getCharacterPositionInScene(
                        Math.max(0, charIdx),
                        scene.characters.length,
                        scene.positionX,
                        scene.positionY
                    );
                    bubbleX = charPos.x + CHARACTER_SIZE / 2;
                    bubbleY = charPos.y - 20;
                }

                const colors = ['#4A90D9', '#52c41a', '#722ed1', '#eb2f96', '#faad14', '#13c2c2', '#f5222d'];
                const colorIdx = character ? character.id % colors.length : 0;

                let displayContent = event.content;
                const tagMatch = displayContent.match(/^【[^】]+】\s*/);
                if (tagMatch) {
                    displayContent = displayContent.slice(tagMatch[0].length);
                }

                return {
                    id: `bubble_${event.id}_${Date.now()}`,
                    characterName: event.characterName || '未知',
                    content: displayContent.slice(0, 60),
                    x: bubbleX,
                    y: bubbleY,
                    opacity: 1,
                    createdAt: Date.now(),
                    color: colors[colorIdx],
                };
            });

            setDialogueBubbles(prev => [...prev, ...newBubbles]);
        }
    }, [events, characters, layoutedScenes]);

    useEffect(() => {
        const interval = setInterval(() => {
            setDialogueBubbles(prev => {
                const now = Date.now();
                return prev
                    .filter(b => now - b.createdAt < BUBBLE_DURATION)
                    .map(b => ({
                        ...b,
                        opacity: Math.max(0, 1 - (now - b.createdAt) / BUBBLE_DURATION),
                    }));
            });
        }, 200);
        return () => clearInterval(interval);
    }, []);

    const drawRoundedRect = useCallback((
        ctx: CanvasRenderingContext2D,
        x: number, y: number,
        w: number, h: number,
        r: number
    ) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }, []);

    const drawBuilding = useCallback((
        ctx: CanvasRenderingContext2D,
        scene: MapScene,
        isHovered: boolean
    ) => {
        const x = scene.positionX;
        const y = scene.positionY;
        const colors = SCENE_COLORS[scene.type] || SCENE_COLORS.public;

        ctx.save();

        if (isHovered) {
            ctx.shadowColor = colors.border;
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 4;
        }

        const sceneImg = sceneImages[scene.id];
        if (sceneImg) {
            ctx.save();
            drawRoundedRect(ctx, x, y, BUILDING_WIDTH, BUILDING_HEIGHT - 20, 8);
            ctx.clip();
            ctx.drawImage(sceneImg, x, y, BUILDING_WIDTH, BUILDING_HEIGHT - 20);
            ctx.restore();

            ctx.strokeStyle = isHovered ? colors.border : `${colors.border}88`;
            ctx.lineWidth = isHovered ? 3 : 2;
            drawRoundedRect(ctx, x, y, BUILDING_WIDTH, BUILDING_HEIGHT - 20, 8);
            ctx.stroke();
        } else {
            const gradient = ctx.createLinearGradient(x, y, x, y + BUILDING_HEIGHT - 20);
            gradient.addColorStop(0, colors.bg);
            gradient.addColorStop(1, `${colors.border}33`);
            ctx.fillStyle = gradient;
            drawRoundedRect(ctx, x, y, BUILDING_WIDTH, BUILDING_HEIGHT - 20, 8);
            ctx.fill();

            ctx.strokeStyle = isHovered ? colors.border : `${colors.border}88`;
            ctx.lineWidth = isHovered ? 3 : 2;
            drawRoundedRect(ctx, x, y, BUILDING_WIDTH, BUILDING_HEIGHT - 20, 8);
            ctx.stroke();

            const roofGradient = ctx.createLinearGradient(x, y - 25, x, y + 5);
            roofGradient.addColorStop(0, colors.roof);
            roofGradient.addColorStop(1, colors.border);
            ctx.fillStyle = roofGradient;
            ctx.beginPath();
            ctx.moveTo(x - 8, y + 5);
            ctx.lineTo(x + BUILDING_WIDTH / 2, y - 25);
            ctx.lineTo(x + BUILDING_WIDTH + 8, y + 5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = `${colors.roof}44`;
            ctx.fillRect(x + 15, y + 20, 25, 25);
            ctx.fillRect(x + BUILDING_WIDTH - 40, y + 20, 25, 25);
            ctx.fillStyle = '#FFF9C4';
            ctx.fillRect(x + 19, y + 24, 17, 17);
            ctx.fillRect(x + BUILDING_WIDTH - 36, y + 24, 17, 17);

            ctx.fillStyle = `${colors.border}66`;
            ctx.fillRect(x + BUILDING_WIDTH / 2 - 10, y + BUILDING_HEIGHT - 45, 20, 25);

            ctx.fillStyle = colors.border;
            ctx.font = 'bold 28px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const typeIcons: Record<string, string> = {
                public: '🏛', shop: '🏪', park: '🌳', school: '🏫',
                hospital: '🏥', home: '🏠', restaurant: '🍽', library: '📚',
                forest: '🌲', castle: '🏰', market: '🎪', bridge: '🌉',
                lake: '💧', church: '⛪', tavern: '🍺',
            };
            ctx.fillText(typeIcons[scene.type] || '🏠', x + BUILDING_WIDTH / 2, y + (BUILDING_HEIGHT - 20) / 2);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        const labelY = y + BUILDING_HEIGHT - 5;
        ctx.fillStyle = isHovered ? colors.border : '#333';
        ctx.font = `bold ${isHovered ? 14 : 13}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const maxWidth = BUILDING_WIDTH + 10;
        let displayName = scene.name;
        while (ctx.measureText(displayName).width > maxWidth && displayName.length > 2) {
            displayName = displayName.slice(0, -1);
        }
        if (displayName !== scene.name) displayName += '…';

        const textWidth = ctx.measureText(displayName).width;
        const padding = 8;
        const tagHeight = 22;
        const tagX = x + BUILDING_WIDTH / 2 - textWidth / 2 - padding;
        const tagY = labelY - 2;

        ctx.fillStyle = isHovered ? colors.border : '#fff';
        ctx.globalAlpha = 0.9;
        drawRoundedRect(ctx, tagX, tagY, textWidth + padding * 2, tagHeight, 4);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = isHovered ? '#fff' : colors.border;
        ctx.fillText(displayName, x + BUILDING_WIDTH / 2, tagY + 2);

        if (scene.characters.length > 0) {
            const badgeX = x + BUILDING_WIDTH - 5;
            const badgeY = y - 5;
            const badgeR = 12;
            ctx.fillStyle = '#f5222d';
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(scene.characters.length), badgeX, badgeY);
        }

        ctx.restore();
    }, [sceneImages, drawRoundedRect]);

    const drawCharacter = useCallback((
        ctx: CanvasRenderingContext2D,
        character: MapCharacter,
        x: number,
        y: number,
        isHovered: boolean
    ) => {
        ctx.save();

        const charImg = characterImages[character.id];
        const size = isHovered ? CHARACTER_SIZE + 4 : CHARACTER_SIZE;

        if (charImg) {
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(charImg, x, y, size, size);
            ctx.restore();
            ctx.save();

            ctx.strokeStyle = isHovered ? '#667eea' : '#fff';
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            const gradient = ctx.createRadialGradient(
                x + size / 2, y + size / 2, 0,
                x + size / 2, y + size / 2, size / 2
            );
            gradient.addColorStop(0, '#8B9FE8');
            gradient.addColorStop(1, '#667eea');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = isHovered ? '#4A5BC7' : '#fff';
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.floor(size * 0.45)}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(character.name.slice(0, 1), x + size / 2, y + size / 2);
        }

        if (isHovered) {
            const nameWidth = ctx.measureText(character.name).width;
            const nameTagW = nameWidth + 12;
            const nameTagH = 20;
            const nameTagX = x + size / 2 - nameTagW / 2;
            const nameTagY = y - nameTagH - 4;

            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            drawRoundedRect(ctx, nameTagX, nameTagY, nameTagW, nameTagH, 4);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = '12px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(character.name, x + size / 2, nameTagY + nameTagH / 2);
        }

        if (character.isOnline) {
            ctx.fillStyle = '#52c41a';
            ctx.beginPath();
            ctx.arc(x + size - 4, y + size - 4, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x + size - 4, y + size - 4, 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }, [characterImages, drawRoundedRect]);

    const drawDialogueBubble = useCallback((
        ctx: CanvasRenderingContext2D,
        bubble: DialogueBubble
    ) => {
        ctx.save();
        ctx.globalAlpha = bubble.opacity;

        const maxWidth = 180;
        ctx.font = '12px "Microsoft YaHei", sans-serif';

        const lines: string[] = [];
        let currentLine = '';
        for (const char of bubble.content) {
            const testLine = currentLine + char;
            if (ctx.measureText(testLine).width > maxWidth - 20) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        const lineHeight = 18;
        const nameHeight = 20;
        const padding = 10;
        const totalHeight = nameHeight + lines.length * lineHeight + padding * 2;
        const totalWidth = Math.min(
            maxWidth,
            Math.max(...lines.map(l => ctx.measureText(l).width), ctx.measureText(bubble.characterName).width) + padding * 2 + 10
        );

        const bx = bubble.x - totalWidth / 2;
        const by = bubble.y - totalHeight;

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        drawRoundedRect(ctx, bx, by, totalWidth, totalHeight, 8);
        ctx.fill();

        ctx.strokeStyle = bubble.color;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, bx, by, totalWidth, totalHeight, 8);
        ctx.stroke();

        ctx.fillStyle = bubble.color;
        drawRoundedRect(ctx, bx, by, totalWidth, nameHeight, 8);
        ctx.fill();
        ctx.fillRect(bx, by + nameHeight - 4, totalWidth, 8);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(bubble.characterName, bx + padding, by + nameHeight / 2);

        ctx.fillStyle = '#333';
        ctx.font = '12px "Microsoft YaHei", sans-serif';
        lines.forEach((line, i) => {
            ctx.fillText(line, bx + padding, by + nameHeight + padding + i * lineHeight + lineHeight / 2);
        });

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.moveTo(bubble.x - 6, by + totalHeight);
        ctx.lineTo(bubble.x, by + totalHeight + 8);
        ctx.lineTo(bubble.x + 6, by + totalHeight);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = bubble.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bubble.x - 6, by + totalHeight);
        ctx.lineTo(bubble.x, by + totalHeight + 8);
        ctx.lineTo(bubble.x + 6, by + totalHeight);
        ctx.stroke();

        ctx.restore();
    }, [drawRoundedRect]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasSize.width * dpr;
        canvas.height = canvasSize.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasSize.height / scale);
        bgGradient.addColorStop(0, '#E8F5E9');
        bgGradient.addColorStop(0.3, '#C8E6C9');
        bgGradient.addColorStop(0.7, '#A5D6A7');
        bgGradient.addColorStop(1, '#81C784');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(-offset.x / scale, -offset.y / scale, canvasSize.width / scale, canvasSize.height / scale);

        ctx.strokeStyle = '#A5D6A744';
        ctx.lineWidth = 1;
        const gridSize = 40;
        const startX = Math.floor(-offset.x / scale / gridSize) * gridSize;
        const startY = Math.floor(-offset.y / scale / gridSize) * gridSize;
        const endX = startX + canvasSize.width / scale + gridSize;
        const endY = startY + canvasSize.height / scale + gridSize;
        for (let gx = startX; gx < endX; gx += gridSize) {
            ctx.beginPath();
            ctx.moveTo(gx, startY);
            ctx.lineTo(gx, endY);
            ctx.stroke();
        }
        for (let gy = startY; gy < endY; gy += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, gy);
            ctx.lineTo(endX, gy);
            ctx.stroke();
        }

        ctx.strokeStyle = '#8D6E6344';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        for (let i = 0; i < layoutedScenes.length - 1; i++) {
            const s1 = layoutedScenes[i];
            const s2 = layoutedScenes[i + 1];
            ctx.beginPath();
            ctx.moveTo(s1.positionX + BUILDING_WIDTH / 2, s1.positionY + BUILDING_HEIGHT / 2);
            ctx.lineTo(s2.positionX + BUILDING_WIDTH / 2, s2.positionY + BUILDING_HEIGHT / 2);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        const sortedScenes = [...layoutedScenes].sort((a, b) => a.positionY - b.positionY);
        for (const scene of sortedScenes) {
            drawBuilding(ctx, scene, hoveredScene === scene.id);

            scene.characters.forEach((char, idx) => {
                const pos = getCharacterPositionInScene(idx, scene.characters.length, scene.positionX, scene.positionY);
                drawCharacter(ctx, char, pos.x, pos.y, hoveredCharacter === char.id);
            });
        }

        for (const bubble of dialogueBubbles) {
            drawDialogueBubble(ctx, bubble);
        }

        ctx.restore();

        animFrameRef.current = requestAnimationFrame(draw);
    }, [canvasSize, offset, scale, layoutedScenes, hoveredScene, hoveredCharacter, dialogueBubbles, drawBuilding, drawCharacter, drawDialogueBubble]);

    useEffect(() => {
        animFrameRef.current = requestAnimationFrame(draw);
        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [draw]);

    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - offset.x) / scale,
            y: (e.clientY - rect.top - offset.y) / scale,
        };
    }, [offset, scale]);

    const findSceneAtPos = useCallback((x: number, y: number): MapScene | null => {
        for (const scene of layoutedScenes) {
            if (
                x >= scene.positionX &&
                x <= scene.positionX + BUILDING_WIDTH &&
                y >= scene.positionY - 25 &&
                y <= scene.positionY + BUILDING_HEIGHT
            ) {
                return scene;
            }
        }
        return null;
    }, [layoutedScenes]);

    const findCharacterAtPos = useCallback((x: number, y: number): MapCharacter | null => {
        for (const scene of layoutedScenes) {
            for (let i = 0; i < scene.characters.length; i++) {
                const pos = getCharacterPositionInScene(i, scene.characters.length, scene.positionX, scene.positionY);
                const dx = x - (pos.x + CHARACTER_SIZE / 2);
                const dy = y - (pos.y + CHARACTER_SIZE / 2);
                if (dx * dx + dy * dy <= (CHARACTER_SIZE / 2) * (CHARACTER_SIZE / 2)) {
                    return scene.characters[i];
                }
            }
        }
        return null;
    }, [layoutedScenes]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }, [offset]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDragging) {
            setOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
            return;
        }

        const coords = getCanvasCoords(e);
        const char = findCharacterAtPos(coords.x, coords.y);
        const scene = findSceneAtPos(coords.x, coords.y);

        setHoveredCharacter(char?.id ?? null);
        setHoveredScene(char ? null : (scene?.id ?? null));

        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.cursor = (char || scene) ? 'pointer' : 'grab';
        }
    }, [isDragging, dragStart, getCanvasCoords, findCharacterAtPos, findSceneAtPos]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDragging) {
            const dx = Math.abs(e.clientX - dragStart.x - offset.x);
            const dy = Math.abs(e.clientY - dragStart.y - offset.y);
            if (dx < 5 && dy < 5) {
                const coords = getCanvasCoords(e);
                const char = findCharacterAtPos(coords.x, coords.y);
                if (char) {
                    onCharacterClick?.(char);
                    return;
                }
                const scene = findSceneAtPos(coords.x, coords.y);
                if (scene) {
                    onSceneClick?.(scene.id);
                }
            }
        }
        setIsDragging(false);
    }, [isDragging, dragStart, offset, getCanvasCoords, findCharacterAtPos, findSceneAtPos, onCharacterClick, onSceneClick]);

    const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(3, Math.max(0.3, scale * delta));

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const newX = mouseX - (mouseX - offset.x) * (newScale / scale);
            const newY = mouseY - (mouseY - offset.y) * (newScale / scale);
            setOffset({ x: newX, y: newY });
        }
        setScale(newScale);
    }, [scale, offset]);

    useEffect(() => {
        if (layoutedScenes.length > 0) {
            const minX = Math.min(...layoutedScenes.map(s => s.positionX));
            const minY = Math.min(...layoutedScenes.map(s => s.positionY));
            const maxX = Math.max(...layoutedScenes.map(s => s.positionX + BUILDING_WIDTH));
            const maxY = Math.max(...layoutedScenes.map(s => s.positionY + BUILDING_HEIGHT));

            const contentWidth = maxX - minX + 200;
            const contentHeight = maxY - minY + 200;

            const scaleX = canvasSize.width / contentWidth;
            const scaleY = canvasSize.height / contentHeight;
            const newScale = Math.min(scaleX, scaleY, 1.2);

            setScale(newScale);
            setOffset({
                x: (canvasSize.width - contentWidth * newScale) / 2 - minX * newScale + 100 * newScale,
                y: (canvasSize.height - contentHeight * newScale) / 2 - minY * newScale + 100 * newScale,
            });
        }
    }, [layoutedScenes.length, canvasSize]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <canvas
                ref={canvasRef}
                style={{
                    width: canvasSize.width,
                    height: canvasSize.height,
                    display: 'block',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                    setIsDragging(false);
                    setHoveredScene(null);
                    setHoveredCharacter(null);
                }}
                onWheel={handleWheel}
            />
            <div style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                background: 'rgba(255,255,255,0.9)',
                padding: '6px 12px',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                fontSize: 12,
                color: '#666',
            }}>
                <span>缩放: {Math.round(scale * 100)}%</span>
                <button
                    onClick={() => setScale(s => Math.min(3, s * 1.2))}
                    style={{ border: 'none', background: '#667eea', color: '#fff', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
                >+</button>
                <button
                    onClick={() => setScale(s => Math.max(0.3, s / 1.2))}
                    style={{ border: 'none', background: '#667eea', color: '#fff', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
                >-</button>
                <button
                    onClick={() => {
                        setScale(1);
                        setOffset({ x: 0, y: 0 });
                    }}
                    style={{ border: 'none', background: '#999', color: '#fff', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
                >重置</button>
            </div>
            {isRunning && (
                <div style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(82,196,26,0.9)',
                    padding: '6px 14px',
                    borderRadius: 20,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(82,196,26,0.3)',
                }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: '#fff',
                        animation: 'pulse 1.5s infinite',
                    }} />
                    小镇运行中 {speed}x
                </div>
            )}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
};

export default TownMap;
export type { MapScene, MapCharacter, MapEvent, DialogueBubble };
