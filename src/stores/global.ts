import { create } from 'zustand';

export interface Character {
    id: number;
    name: string;
    avatarUrl: string | null;
    description: string;
    plotSetting: string;
    currentScene?: string;
    isOnline?: boolean;
}

export interface Scene {
    id: number;
    name: string;
    nameEn: string;
    type: string;
    description?: string;
    characters: Character[];
}

export interface TownEvent {
    id: number;
    characterId: number;
    characterName: string;
    characterAvatar?: string;
    type: 'message' | 'action' | 'location';
    content: string;
    timestamp: string;
    isRead: boolean;
}

export interface Novel {
    id: number;
    title: string;
    author: string;
}

export interface ChatMessage {
    id: number;
    senderId: number;
    senderName: string;
    senderAvatar?: string;
    content: string;
    timestamp: string;
    isMe?: boolean;
}

export interface ChatSession {
    id: number;
    name: string;
    participantIds: number[];
    participantNames: string[];
    lastMessage?: string;
    lastMessageTime?: string;
}

export interface Memory {
    id: number;
    content: string;
    type: 'plot' | 'dialogue' | 'reflection' | 'observation';
    timestamp: string;
    importance: number;
}

interface GlobalState {
    novel: Novel | null;
    characters: Character[];
    scenes: Scene[];
    events: TownEvent[];

    currentSession: ChatSession | null;
    sessions: ChatSession[];
    messages: Record<number, ChatMessage[]>;

    isRunning: boolean;
    speed: number;
    currentTime: Date;

    pageLoading: boolean;
    error: string | null;

    unreadCount: number;
    lastUpdateTime: number;

    setNovel: (novel: Novel | null) => void;
    setCharacters: (characters: Character[]) => void;
    setScenes: (scenes: Scene[]) => void;
    setEvents: (events: TownEvent[]) => void;
    addEvent: (event: TownEvent) => void;

    setCurrentSession: (session: ChatSession | null) => void;
    setSessions: (sessions: ChatSession[]) => void;
    addSession: (session: ChatSession) => void;
    setSessionMessages: (sessionId: number, messages: ChatMessage[]) => void;
    addSessionMessage: (sessionId: number, message: ChatMessage) => void;

    setIsRunning: (isRunning: boolean) => void;
    setSpeed: (speed: number) => void;
    setCurrentTime: (time: Date) => void;

    setPageLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    clearError: () => void;

    setUnreadCount: (count: number) => void;
    setLastUpdateTime: (time: number) => void;

    reset: () => void;
}

const initialState = {
    novel: null,
    characters: [],
    scenes: [],
    events: [],
    currentSession: null,
    sessions: [],
    messages: {},
    isRunning: false,
    speed: 1,
    currentTime: new Date(),
    pageLoading: false,
    error: null,
    unreadCount: 0,
    lastUpdateTime: Date.now(),
};

export const useGlobalStore = create<GlobalState>((set) => ({
    ...initialState,

    setNovel: (novel) => set({ novel }),
    setCharacters: (characters) => set({ characters }),
    setScenes: (scenes) => set({ scenes }),
    setEvents: (events) => set({ events }),
    addEvent: (event) => set((state) => ({
        events: [...state.events.slice(-49), event]
    })),

    setCurrentSession: (currentSession) => set({ currentSession }),
    setSessions: (sessions) => set({ sessions }),
    addSession: (session) => set((state) => ({
        sessions: [session, ...state.sessions]
    })),
    setSessionMessages: (sessionId, messages) => set((state) => ({
        messages: { ...state.messages, [sessionId]: messages }
    })),
    addSessionMessage: (sessionId, message) => set((state) => ({
        messages: {
            ...state.messages,
            [sessionId]: [...(state.messages[sessionId] || []), message].slice(-99)
        }
    })),

    setIsRunning: (isRunning) => set({ isRunning }),
    setSpeed: (speed) => set({ speed }),
    setCurrentTime: (currentTime) => set({ currentTime }),

    setPageLoading: (pageLoading) => set({ pageLoading }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),

    setUnreadCount: (unreadCount) => set({ unreadCount }),
    setLastUpdateTime: (lastUpdateTime) => set({ lastUpdateTime }),

    reset: () => set(initialState),
}));

export default useGlobalStore;
