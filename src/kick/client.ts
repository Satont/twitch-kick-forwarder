import { Events, Kient } from 'kient'
import * as OTPAuth from "otpauth";
import type { OnMessage } from '../types/types.js';

type Opts = {
  email: string,
  password: string,
  totpSecret: string,
}

type Channel = Awaited<ReturnType<Kient['api']['channel']['getChannel']>>

// @ts-ignore
export class Kick {
  #kient?: Kient

  #currentChannel?: Channel
  #cachedChannels: Array<Channel> = [];

  get currentChannel() {
    if (!this.#currentChannel) {
      throw new Error('Current channel not initialized')
    }

    return this.#currentChannel;
  }

  async create(opts: Opts): Promise<Kick> {
    const client = await Kient.create();
    this.#kient = client

    const totp = new OTPAuth.TOTP({
      issuer: "ACME",
      label: "AzureDiamond",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: opts.totpSecret,
    });

    const token = totp.generate();
    const delta = totp.validate({ token, window: 1 })

    if (delta === null) {
      throw new Error('Invalid totp token')
    }

    await client.api.authentication.login({
      email: opts.email,
      password: opts.password,
      otc: token,
    })

    const currentUser = await client.api.authentication.currentUser();

    this.#currentChannel = await this.#getChannelByName(currentUser.username);

    return this
  }

  async #join(userName: string) {
    const channel = await this.#getChannelByName(userName)
    await this.#kient!.ws.channel.listen(channel.data.id)
    await channel.connectToChatroom()
    console.info(`[KICK]: Joined ${channel.data.user.username}#${channel.data.user.id}`)
  }

  async #getChannelByName(name: string) {
    const cached = this.#cachedChannels.find(c => c.data.user.username.toLowerCase() === name.toLowerCase())
    if (cached) {
      return cached
    }

    const channel = await this.#kient!.api.channel.getChannel(name)
    this.#cachedChannels.push(channel)

    return channel
  }

  async joinSelf() {
    if (!this.#currentChannel) {
      throw new Error('Current user not yet initialized')
    }

    await this.#join(this.#currentChannel.data.user.username)
  }

  async joinChannel(channelName: string) {
    await this.#join(channelName)
  }

  async attachListener(onMessage: OnMessage) {
    this.#kient!.on(Events.Chatroom.Message, (messageInstance) => {
      const message = messageInstance.data

      if (message.sender.id === this.#currentChannel?.data.user.id || message.sender.username.toLowerCase() === 'botrix') {
        return
      }

      onMessage({
        message: message.content,
        userName: message.sender.username,
        provider: 'kick'
      })
    })
  }

  async say(channelName: string, message: string) {
    const channel = await this.#getChannelByName(channelName)
    if (!channel) {
      throw new Error('Channel not found')
    }

    const chatRoom = channel.getChatroom()

    await this.#kient?.api.chat.sendMessage(chatRoom.id, message)
  }
}