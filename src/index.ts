import { Kick } from "./kick/client.js"
import { Twitch } from "./twitch/client.js"
import type { OnMessage } from "./types/types.js"

const {
  KICK_EMAIL,
  KICK_PASSWORD,
  KICK_TOTP_SECRET,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_REFRESH_TOKEN,
} = process.env

if ([
  KICK_EMAIL,
  KICK_PASSWORD,
  KICK_TOTP_SECRET,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_REFRESH_TOKEN,
].some(v => !v)) {
  throw new Error('Not enough envirement variables for start project')
}

const kickClient = await new Kick().create({
  email: KICK_EMAIL!,
  password: KICK_PASSWORD!,
  totpSecret: KICK_TOTP_SECRET!,
})

const twitchClient = await new Twitch().create({
  clientId: TWITCH_CLIENT_ID!,
  clientSecret: TWITCH_CLIENT_SECRET!,
  refreshToken: TWITCH_REFRESH_TOKEN!,
})

const onMessage: OnMessage = (opts) => {
  if (opts.provider === 'kick') {
    twitchClient.say(twitchClient.currentUser.name, `[KICK] ${opts.userName}: ${opts.message}`)
  } else {
    kickClient.say(kickClient.currentChannel.data.user.username, `[TWITCH] ${opts.userName}: ${opts.message}`)
  }
}

await kickClient.attachListener(onMessage)
await kickClient.joinSelf()

await twitchClient.attachListeners(onMessage)
await twitchClient.joinSelf()