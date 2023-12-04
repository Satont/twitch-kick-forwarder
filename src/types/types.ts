export type OnMessage = (opts: { userName: string, message: string, provider: 'kick' | 'twitch' }) => void | Promise<void>