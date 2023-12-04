import { RefreshingAuthProvider } from '@twurple/auth'
import { ApiClient, HelixUser } from '@twurple/api'
import { ChatClient } from '@twurple/chat'
import type { OnMessage } from '../types/types'

type Opts = {
  clientId: string,
  clientSecret: string,
  refreshToken: string,
}

export class Twitch {
  #authProvider?: RefreshingAuthProvider
  #api?: ApiClient
  #chat?: ChatClient

  #currentUser?: HelixUser

  get currentUser() {
    if (!this.#currentUser) {
      throw new Error('User not yet intialized')
    }

    return this.#currentUser;
  }
  
  async create(opts: Opts) {
    this.#authProvider = new RefreshingAuthProvider({
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
    })

    await this.#authProvider.addUserForToken({
      refreshToken: opts.refreshToken,
      expiresIn: 0,
      obtainmentTimestamp: 0,
    }, ['chat'])

    this.#api = new ApiClient({
      authProvider: this.#authProvider,
    })

    this.#chat = new ChatClient({
      authProvider: this.#authProvider,
    })

    const currentUserInfo = await this.#api.asIntent(['chat'], async (ctx) => {
      const token = await ctx.getTokenInfo();
      if (!token?.userId) {
        throw new Error('No token')
      }
      return await ctx.users.getAuthenticatedUser(token.userId)
    })

    if (!currentUserInfo) {
      throw new Error('Cannot get current user info')
    }

    this.#currentUser = currentUserInfo!

    this.#chat.connect();

    return this
  }

  async joinSelf() {
    if (!this.#authProvider || !this.#chat || !this.#api || !this.#currentUser) {
      throw new Error('Client not yet initialized')
    }

    await this.#chat.join(this.#currentUser.name)
    console.info(`[TWITCH] Joined ${this.#currentUser.displayName}#${this.#currentUser.id}`)
  }

  async attachListeners(onMessage: OnMessage) {
    this.#chat!.onMessage((channel, user, text, msg) => {
      if (msg.userInfo.userId === this.#currentUser?.id) {
        return
      }

      onMessage({
        userName: user,
        message: text,
        provider: 'twitch',
      })
    })
  }

  async say(channelName: string, text: string) {
    if (!this.#chat) {
      throw new Error('Chat not initialized')
    }

    this.#chat.say(channelName, text);
  }
}