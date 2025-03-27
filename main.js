// Fortnite Bot Royale - March 2025
// Based on NexBL V1 by AjaxFNC
var currentVer = 1.4
const nconf = require('nconf');
const config = nconf.argv().env().file({ file: 'config.json' });
const { Client: FNclient, Enums } = require('fnbr');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios').default;
const path = require('path');
const os = require('os');
const Websocket = require('ws');
const { allowedPlaylists, websocketHeaders } = require('./utils/constants');
const xmlparser = require('xml-parser');

require('colors');

const bLog = true;
const GetVersion = require('./utils/version');
//get discord spam here
const webhookUrl = '';

// Config variables
const emoteName = nconf.get('fortnite:emote');
const skinName = nconf.get('fortnite:skin');
const backpackName = nconf.get('fortnite:backpack');
const level = nconf.get('fortnite:level');
const banner = nconf.get('fortnite:banner');
const join_users = nconf.get('fortnite:join_users');
const bot_use_status = nconf.get('fortnite:inuse_status');
const bot_use_onlinetype = nconf.get('fortnite:inuse_onlinetype');
const bot_invite_status = nconf.get('fortnite:invite_status');
const bot_invite_onlinetype = nconf.get('fortnite:invite_onlinetype');
const bot_join_message = nconf.get('fortnite:join_message');
const bot_leave_time = nconf.get('fortnite:leave_time');
const addusers = nconf.get('fortnite:add_users');
const leave_after = nconf.get('fortnite:leave_after_success');

// Utility functions
const fetchCosmetic = async (name, type) => {
  try {
    const { data } = await axios.get(`https://fortnite-api.com/v2/cosmetics/br/search?name=${encodeURI(name)}&type=${type}&responseFlags=7`);
    return data.data;
  } catch (err) {
    console.log(err);
    return undefined;
  }
};

const getCosmeticPath = (path) => {
  if (!path) throw new Error("Path is undefined");
  return path
    .replace(/^FortniteGame\/Content/, '/Game')
    .replace(/FortniteGame\/Plugins\/GameFeatures\/BRCosmetics\/Content/, '/BRCosmetics')
    .split('/')
    .slice(0, -1)
    .join('/');
};

function removeAccountInfo(refreshToken) {
  const envPath = path.resolve(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envConfig = dotenv.parse(envContent);

  let keyPrefix = null;
  for (let key in envConfig) {
    if (envConfig[key] === refreshToken && (key.startsWith('refreshToken') || key === 'refreshToken')) {
      keyPrefix = key.match(/\d*$/)[0] || '';
      break;
    }
  }

  if (keyPrefix !== null) {
   // delete envConfig[`accountId${keyPrefix}`];
   // delete envConfig[`deviceId${keyPrefix}`];
   // delete envConfig[`secret${keyPrefix}`];
    delete envConfig[`refreshToken`]; // Added to remove refresh token
    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync(envPath, updatedEnv, 'utf8');
    //console.log(`[ENV] Removed old account info for accountId: ${accountId}`.yellow);
    //console.log(`[ENV] Updated .env content:\n${updatedEnv}`.blue);
    console.log(updatedEnv);
  } else {
    //console.log(`AccountId ${accountId} not found.`);
  }
}

function calcChecksum(payload, signature) {
  let token = process.env.checksumtoken;
  let hashtype = process.env.checksumhashtype;
  const plaintext = payload.slice(10, 20) + token + signature.slice(2, 10);
  const data = Buffer.from(plaintext, 'utf16le');
  const hashObject = crypto.createHash(hashtype);
  const hashDigest = hashObject.update(data).digest();
  return Buffer.from(hashDigest.subarray(2, 10)).toString('hex').toUpperCase();
}

function incrementCreatedMatches(incrementBy) {
  const filePath = path.join(__dirname, 'matches.json');
  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileData);
    jsonData.createdMatches = (parseInt(jsonData.createdMatches) || 0) + incrementBy;
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    console.log(`Successfully incremented createdMatches by ${incrementBy}. New value: ${jsonData.createdMatches}`);
  } catch (error) {
    console.error('Error while updating matches.json:', error.message);
  }
}

function viewCreatedMatches() {
  const filePath = path.join(__dirname, 'matches.json');
  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileData);
    jsonData.createdMatches = parseInt(jsonData.createdMatches) || 0;
    console.log(jsonData.createdMatches);
    return jsonData.createdMatches;
  } catch (error) {
    console.error('Error while getting matches.json:', error.message);
  }
}

async function sendWebhookEmbed(title, description, colorHex) {
  const embed = {
    title,
    description,
    color: colorHex,
    timestamp: new Date().toISOString(),
  };
  try {
    await axios.post(webhookUrl, { embeds: [embed] });
    console.log('Webhook embed sent successfully.');
  } catch (error) {
    console.error('Failed to send webhook embed:', error.message);
  }
}

async function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// Config variables (do not touch this)
const clientId = '3f69e56c7649492c8cc29f1af08a8a12';
const clientSecret = 'b51ee9cb12234f50a69efa67ef53812e';

// Utility function to refresh token
async function refreshAuthToken(client, refreshToken) {
  try {
    const response = await axios.post(
      'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token',
      `grant_type=refresh_token&refresh_token=${refreshToken}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      }
    );
    const { access_token, refresh_token, expires_in } = response.data;
    console.log(`[AUTH] Refreshed token for ${client.auth.sessions.get("fortnite").displayName}`.green);
    return { accessToken: access_token, refreshToken: refresh_token, expiresIn: expires_in };
  } catch (error) {
    console.error(`[AUTH ERROR] Failed to refresh token: ${error.response?.data?.error || error.message}`.red);
    throw error;
  }
}

// Main execution
(async () => {
  console.log(`[LOGS] Starting up Fortnite Bot Royale version ${currentVer}...`.blue)
  console.log(`[LOGS] Loading cosmetics...`.blue)
  let skinObj = await fetchCosmetic(skinName, "outfit");
  let backpackObj = await fetchCosmetic(backpackName, "backpack");
  let emoteObj = await fetchCosmetic(emoteName, "emote");

  let skinCid = skinObj ? skinObj.id : undefined;
  let backpackBid = backpackObj ? backpackObj.id : undefined;
  let emoteEid = emoteObj ? emoteObj.id : undefined;

  console.log(`[LOGS] Skin: ${skinCid}\n[LOGS] Backpack: ${backpackBid}\n[LOGS] Emote: ${emoteEid}`);

  const lastest = await GetVersion();
  const Platform = os.platform() === "win32" ? "Windows" : os.platform();
  const UserAgent = `Fortnite/${lastest.replace('-Windows', '')} ${Platform}/${os.release()}`;
  axios.defaults.headers["user-agent"] = UserAgent;
  console.log("[LOGS] UserAgent set to".yellow, axios.defaults.headers["user-agent"].yellow);

  let accountsobject = [];
  let index = 1;

  while (index <= 1) {

    if (process.env[`refreshToken`] === undefined) {
    console.log(`\n***** FIRST TIME SETUP *****\n[WARNING] Make sure to be signed into the Epic Games account that will serve as the bot account!! Use incognito mode, or another browser to make sure!\n[LOGIN] Open this website, copy the "authorizationCode", and paste it here.\n[LOGIN] The website: https://www.epicgames.com/id/api/redirect?clientId=3f69e56c7649492c8cc29f1af08a8a12&responseType=code`.red)
  } else {
    console.log(`[LOGIN] Login data detected`.blue)

  }

    const client = new FNclient({
      defaultStatus: "Fortnite",
      xmppDebug: false,
      platform: 'WIN',
      partyConfig: {
        chatEnabled: true,
        maxSize: 6
      },
      auth: {
        refreshToken: process.env[`refreshToken`],
    }
  });

    accountsobject.push(client);
    index++;
  }

  await Promise.all(accountsobject.map(async (client, idx) => {
    let bIsMatchmaking = false;
    let timerstatus = false;

    // Login and handle refresh token
    try {
      // Before logging in, remove any old data for previous login
      if (client.auth.sessions.get("fortnite")?.refreshToken) {
        removeAccountInfo(client.auth.sessions.get("fortnite").refreshToken);
      }

      await client.login();
      const FNusername = client.auth.sessions.get("fortnite").displayName;

    //  const accountId = client.auth.sessions.get("fortnite").accountId;
      const refreshToken = client.auth.sessions.get("fortnite").refreshToken;
     // const deviceId = client.auth.sessions.get("fortnite").deviceId || crypto.randomUUID(); // Generate if not provided
     // const secret = client.auth.sessions.get("fortnite").secret || crypto.randomBytes(16).toString('hex'); // Generate if not provided

      if (refreshToken) {
        removeAccountInfo(refreshToken); // Ensure old data is gone
        const envPath = path.resolve(__dirname, '.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        const envConfig = dotenv.parse(envContent);

      
       // envConfig[`accountId`] = accountId;
       // envConfig[`deviceId`] = deviceId;
       // envConfig[`secret`] = secret;
        envConfig[`refreshToken`] = refreshToken;

        const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
        fs.writeFileSync(envPath, updatedEnv, 'utf8');
        console.log(`[ENV] Stored new authentification data for ${FNusername}`.green);
        console.log(`[LOGIN] Logged in as ${FNusername}`.green);
      }
    } catch (error) {
      console.error(`[LOGIN ERROR] Initial login failed: ${error.message}`.red);
      return;
    }

    client.setStatus(bot_invite_status, bot_invite_onlinetype);

    client.on('auth:expired', async () => {
      console.log(`[AUTH] Access token expired for ${client.auth.sessions.get("fortnite").displayName}`.yellow);
      try {
        const refreshToken = client.auth.sessions.get("fortnite").refreshToken;
        const { accessToken, refreshToken: newRefreshToken } = await refreshAuthToken(client, refreshToken);

        // Update client session
        client.auth.sessions.get("fortnite").accessToken = accessToken;
        client.auth.sessions.get("fortnite").refreshToken = newRefreshToken;

        // Update .env with new refresh token
        //const accountId = client.auth.sessions.get("fortnite").accountId;
        //removeAccountInfo(accountId); // Remove old data
        const envPath = path.resolve(__dirname, '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        const envConfig = dotenv.parse(envContent);

       // envConfig[`accountId${botIndex}`] = accountId;
       // envConfig[`deviceId${botIndex}`] = client.auth.sessions.get("fortnite").deviceId;
       // envConfig[`secret${botIndex}`] = client.auth.sessions.get("fortnite").secret;
        envConfig[`refreshToken`] = newRefreshToken;

        const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
        fs.writeFileSync(envPath, updatedEnv, 'utf8');
        console.log(`[AUTH] Session refreshed and .env updated for ${client.auth.sessions.get("fortnite").displayName}`.green);
      } catch (error) {
        console.error(`[AUTH ERROR] Failed to refresh session: ${error.message}`.red);
        await disconnectBot(client);
      }
    });

    // Party initialization
    try {
      await client.party.setPrivacy(Enums.PartyPrivacy.PRIVATE);
      console.log(`[PARTY] Privacy set to PRIVATE`.green);
    } catch (e) {
      console.log(`[PARTY] Failed to set privacy: ${e.message}`.red);
    }

    await client.party.me.setLevel(level);
    await client.party.me.setBanner(banner);
    await client.party.me.setOutfit(skinCid, undefined, undefined);
    await client.party.me.setBackpack(backpackBid, undefined, getCosmeticPath(backpackObj.path));

    // HTTP error interceptor
    axios.interceptors.response.use(undefined, function (error) {
      if (error.response && error.response.data.errorCode) {
        if (error.response.data.errorCode === "errors.com.epicgames.fortnite.player_banned_from_sub_game") {
          console.log(error.response.data.errorCode);
        }
        // Modified to check if party exists before sending
        if (client.party) {
          client.party.sendMessage(`HTTP Error: ${error.response.status} ${error.response.data.errorCode} ${error.response.data.errorMessage}`);
        }
        console.error(error.response.status, error.response.data);
      }
      return error;
    });

    // Party updated event
    client.on('party:updated', async (updated) => {
      if (!client.party) {
        console.log(`[PARTY ERROR] Party update received but no party exists`.red);
        return;
      }
      switch (updated.meta.schema["Default:PartyState_s"]) {
        case "BattleRoyalePreloading": {
          var loadout = client.party.me.meta.set("Default:LobbyState_j", { "LobbyState": { "hasPreloadedAthena": true } });
          await client.party.me.sendPatch({ 'Default:LobbyState_j': loadout });
          break;
        }
        case "BattleRoyaleView": {
            var loadout = client.party.me.meta.set("Default:LobbyState_j", { "LobbyState": { "hasPreloadedAthena": true } });
            await client.party.me.sendPatch({ 'Default:LobbyState_j': loadout });
            break;
          }
        case "BattleRoyaleMatchmaking": {
          if (bIsMatchmaking) {
            console.log('Members has started matchmaking!'.green);
            return;
          }
          bIsMatchmaking = true;
          if (bLog) console.log(`[${'Matchmaking'.cyan}]`, 'Matchmaking Started'.cyan);

          const PartyMatchmakingInfo = JSON.parse(updated.meta.schema["Default:PartyMatchmakingInfo_j"]).PartyMatchmakingInfo;
          const playlistId = PartyMatchmakingInfo.playlistName.toLocaleLowerCase();

          if (!allowedPlaylists.includes(playlistId)) {
            console.log("Unsupported playlist".red, playlistId.red);
            await client.party.chat.send(`Playlist id: ${playlistId} is not a supported gamemode!`);
            client.party.me.setReadiness(false);
            return;
          }

          var partyPlayerIds = client.party.members.filter(x => x.isReady).map(x => x.id).join(',');
          const bucketId = `${PartyMatchmakingInfo.buildId}:${PartyMatchmakingInfo.playlistRevision}:${PartyMatchmakingInfo.regionId}:${playlistId}`;
          console.log(bucketId.yellow);
          console.log(partyPlayerIds.yellow);

          var query = new URLSearchParams();
          query.append("partyPlayerIds", partyPlayerIds);
          query.append("bucketId", bucketId);
          query.append("player.option.linkCode", playlistId.toString());
          query.append("player.platform", "Windows");
          query.append("player.input", "KBM");
          query.append("input.KBM", "true");
          query.append("player.option.preserveSquad", "false");
          query.append("player.option.crossplayOptOut", "false");
          query.append("player.option.partyId", client.party.id);
          query.append("player.option.splitScreen", "false");
          query.append("party.WIN", "true");
          query.append("player.option.microphoneEnabled", "false");
          query.append("player.option.uiLanguage", "en");

          client.party.members.filter(x => x.isReady).forEach(Member => {
            const platform = Member.meta.get("Default:PlatformData_j");
            if (!query.has(`party.{PlatformName}`)) {
              query.append(`party.{PlatformName}`, "true");
            }
          });
          const token = client.auth.sessions.get("fortnite").accessToken;
          if (!token) {
            console.error('Authentication token not available');
            client.party.me.setReadiness(false);
            return;
          }
          const TicketRequest = await axios.get(
            `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/matchmakingservice/ticket/player/${client.user.self.id}?${query}`,
            {
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`
              }
            }
          );
          if (TicketRequest.status !== 200) {
            console.log(`[${'Matchmaking'.cyan}]`, 'Error while obtaining ticket'.red);
            client.party.me.setReadiness(false);
            return;
          }

          const ticket = TicketRequest.data;
          const calculatedchecksum = calcChecksum(ticket.payload, ticket.signature);

          var MMSAuth = ["Epic-Signed", ticket.ticketType, ticket.payload, ticket.signature, calculatedchecksum];
          const matchmakingClient = new Websocket(ticket.serviceUrl, {
            perMessageDeflate: false,
            rejectUnauthorized: false,
            headers: {
              Origin: ticket.serviceUrl.replace('ws', 'http'),
              Authorization: MMSAuth.join(" "),
              ...websocketHeaders
            }
          });

          matchmakingClient.on('unexpected-response', (request, response) => {
            let data = '';
            response.on('data', (chunk) => data += chunk);
            response.on('end', () => {
              const baseMessage = `[MATCHMAKING] Error while connecting to matchmaking service: (status ${response.statusCode} ${response.statusMessage})`;
              if (client.party) {
                client.party.chat.send(`Error while connecting to matchmaking service: (status ${response.statusCode} ${response.statusMessage})`);
              }
              if (data === '') console.error(baseMessage);
              else if (response.headers['content-type'].startsWith('application/json')) {
                const jsonData = JSON.parse(data);
                if (jsonData.errorCode) {
                  console.error(`${baseMessage}, ${jsonData.errorCode} ${jsonData.errorMessage || ''}`);
                  if (client.party) {
                    client.party.chat.send(`Error while connecting to matchmaking service: ${jsonData.errorCode} ${jsonData.errorMessage || ''}`);
                  }
                } else console.error(`${baseMessage} response body: ${data}`);
              } else if (response.headers['x-epic-error-name']) {
                console.error(`${baseMessage}, ${response.headers['x-epic-error-name']} response body: ${data}`);
              } else if (response.headers['content-type'].startsWith('text/html')) {
                const parsed = xmlparser(data);
                if (parsed.root) {
                  try {
                    const title = parsed.root.children.find(x => x.name === 'head').children.find(x => x.name === 'title');
                    console.error(`${baseMessage} HTML title: ${title}`);
                  } catch {
                    console.error(`${baseMessage} HTML response body: ${data}`);
                  }
                } else console.error(`${baseMessage} HTML response body: ${data}`);
              } else console.error(`${baseMessage} response body: ${data}`);
            });
          });

          if (bLog) matchmakingClient.on('close', () => console.log(`[${'Matchmaking'.cyan}]`, 'Connection to the matchmaker closed'));
          matchmakingClient.on('message', (msg) => {
            const message = JSON.parse(msg);
            if (bLog) console.log(`[${'Matchmaking'.cyan}]`, 'Message from the matchmaker', message);
            if (message.name === 'Error') bIsMatchmaking = false;
          });
          break;
        }
        case "BattleRoyalePostMatchmaking": {
          if (bLog) console.log(`[${'Party'.magenta}]`, 'Players entered loading screen, Exiting party...');
          incrementCreatedMatches(1);
          let createdMatches = viewCreatedMatches();

          var partyPlayerNames = client.party.members.map(x => `- ${x.displayName}`).join('\n');
          const PartyMatchmakingInfo = JSON.parse(updated.meta.schema["Default:PartyMatchmakingInfo_j"]).PartyMatchmakingInfo;

          if (client.party?.me?.isReady) {
            client.party.me.setReadiness(false).catch(err => console.error(`[PARTY ERROR] Set readiness failed: ${err.message}`.red));
          }
          bIsMatchmaking = false;

          if (leave_after === true) {
            client.party.leave();
            break;
          } else if (leave_after === false) {
            async function timeexpire() {
              if (client.party) {
                client.party.chat.send("Time expired!");
              }
              await sleep(1.2);
              client.party.leave();
              console.log("[PARTY] Left party due to party time expiring!".yellow);
              console.log("[PARTY] Time tracking stopped!".yellow);
              timerstatus = false;
            }
            this.ID = setTimeout(timeexpire, 3600000);
            break;
          }
          break;
        }
        case "BattleRoyaleView": {
          break;
        }
        default: {
          if (bLog) console.log(`[${'Party'.magenta}]`, 'Unknown PartyState'.yellow, updated.meta.schema["Default:PartyState_s"]);
          break;
        }
      }
    });

// Track party ID globally
let currentPartyId = null;

// Sync party ID on invite acceptance
client.on('party:invite', async (request) => {
  try {
    if (client.party && client.party.size === 1 && join_users === true) {
      await sleep(2); 
      await request.accept();
      console.log(`[PARTY] Accepted invite from ${request.sender.displayName}`.green);
      
      currentPartyId = client.party.id;
      
      await sleep(1); 
      if (client.party) {
        client.party.chat.send("Joined your party!");
      }
    } else {
      await sleep(2);
      await request.decline();
      console.log(`[PARTY] Declined invite from ${request.sender.displayName} (party size: ${client.party?.size || 'none'})`.yellow);
    }
  } catch (e) {
    console.log(`[WARNING] If the bot has joined your lobby, ignore this!\n[PARTY ERROR] Invite handling failed: ${e.message}`.red);
  }
});

// Sync party ID on party updates
client.on('party:updated', (updated) => {
  if (updated.id !== currentPartyId) {
    currentPartyId = updated.id;
    client.party = updated; // Ensure client.party reflects the latest state
  }
});

// Party member updated handler without debug logs
client.on("party:member:updated", async (Member) => {
  if (Member.id === client.user.id || !client.party?.me) return;

  // Ensure party ID is current
  if (currentPartyId && currentPartyId !== client.party?.id) {
    client.party.id = currentPartyId; // Manual update (risky, see notes)
  }

  if ((Member.isReady && (client.party?.me?.isLeader || Member.isLeader) && !client.party?.me?.isReady) && !client.party.bManualReady) {
    if (!client.party) {
      console.log(`[PARTY ERROR] Cannot update readiness: No party exists`.red);
      return;
    }
    try {
      if (client.party.me.isLeader) {
        await Member.promote();
      }
      await client.party.me.setReadiness(true);
    } catch (err) {
      console.error(`[PARTY ERROR] Set readiness failed: ${err.message}`.red);
    }
  } else if ((!Member.isReady && Member.isLeader) && !client.party.bManualReady) {
    try {
      // Close WebSocket if it exists
      if (client?.WSS?.close) {
        client.WSS.close();
      }

      // Double-check party existence
      if (!client.party) {
        console.log(`[PARTY ERROR] Party no longer exists before setting readiness false`.red);
        return;
      }
      await sleep(2)
      await client.party.me.setReadiness(false);
    } catch (err) {
      console.error(`[PARTY ERROR] Set readiness failed: ${err.message}`.red);
      if (err.message.includes("Set readiness failed: Party")) {
        try {
          // Reinitialize party state
          await client.party.setPrivacy(Enums.PartyPrivacy.PRIVATE);
          currentPartyId = client.party?.id;

          // Retry setting readiness
          await client.party.me.setReadiness(false);
        } catch (recoveryErr) {
          console.error(`[PARTY RECOVERY ERROR] Failed to recover: ${recoveryErr.message}`.red);
          if (currentPartyId) {
            await client.party.leave();
          }
        }
      }
    }
  }
});
    // Friend request event
    client.on('friend:request', async (request) => {
      try {
        if (addusers === true) {
          await request.accept();
        } else {
          await request.decline();
          console.log(`[PARTY] Declined friend request from: ${request.displayName}. Reason: Friend requests are disabled.`);
        }
      } catch (e) {
        console.log(e);
      }
    });

    // Party invite event
    client.on('party:invite', async (request) => {
      try {
        if (client.party && client.party.size === 1 && join_users === true) {
          await sleep(1);
          currentPartyId = null;
          await request.accept();
          console.log(`[PARTY] Accepted invite from ${request.sender.displayName}`.green);
          await sleep(1); // Additional delay to stabilize
          if (client.party) {
            client.party.chat.send("Joined your party!");
          }
        } else {
          await sleep(2);
          await request.decline();
          console.log(`[PARTY] Declined invite from ${request.sender.displayName} (party size: ${client.party?.size || 'none'})`.yellow);
        }
      } catch (e) {
        console.log(`[PARTY ERROR] Invite handling has failed: ${e.message}`.red);
      }
    });

    // Command handler
    const handleCommand = async (m) => {
      if (!m.content.startsWith('!')) return;
      const args = m.content.slice(1).split(' ');
      const command = args.shift().toLowerCase();

      if (command === 'outfit' || command === 'skin') {
        const skin = await fetchCosmetic(args.join(' '), 'outfit');
        if (!skin) {
          await m.reply(`The skin ${args.join(' ')} wasn't found!`);
          return;
        }
        await m.client.party.me.setOutfit(skin.id, undefined, undefined);
        await m.reply(`Set the skin to ${skin.name}!`);
      } else if (command === 'emote' || command === 'dance') {
        const emote = await fetchCosmetic(args.join(' '), 'emote');
        if (!emote) {
          await m.reply(`The emote ${args.join(' ')} wasn't found!`);
          return;
        }
        try {
          const path = getCosmeticPath(emote.path);
          await m.client.party.me.setEmote(emote.id, path);
          await m.reply(`Set the emote to ${emote.name}!`);
        } catch (error) {
          await m.reply(`Failed to set the emote due to: ${error.message}`);
        }
      }
    };

    client.on('party:member:message', handleCommand);
    client.on('friend:message', handleCommand);

    // Party member joined event
    client.on('party:member:joined', async (join) => {
      if (!client.party) {
        console.log(`[PARTY ERROR] Member joined but no party exists`.red);
        return;
      }

      const setStats = async () => {
        client.party.me.sendPatch({
          'Default:FORTStats_j': '{"FORTStats":{"fortitude":3000,"offense":3000,"resistance":3000,"tech":3000,"teamFortitude":3000,"teamOffense":3000,"teamResistance":3000,"teamTech":3000,"fortitude_Phoenix":3000,"offense_Phoenix":3000,"resistance_Phoenix":3000,"tech_Phoenix":3000,"teamFortitude_Phoenix":3000,"teamOffense_Phoenix":3000,"teamResistance_Phoenix":3000,"teamTech_Phoenix":3000}}'
        });
        await client.party.me.setOutfit(skinCid, undefined, undefined);
        await client.party.me.setBackpack(backpackBid, [], getCosmeticPath(backpackObj.path));
        await sleep(1.5);
      };

      const updateStatusAndChat = async () => {
        const partySize = client.party.size;
        console.log(`[PARTY] Current size: ${partySize}`.blue);
        if ([2, 3, 4].includes(partySize)) {
          await client.party.chat.send(`${bot_join_message}\n Join the discord: discord.gg/nexfn`);
          client.setStatus(bot_use_status, bot_use_onlinetype);
        }
        if (partySize === 1) {
          client.setStatus(bot_invite_status, bot_invite_onlinetype);
          await client.party.setPrivacy(Enums.PartyPrivacy.PRIVATE).catch(err => console.log(`[PARTY] Privacy reset failed: ${err.message}`.red));
          if (client.party?.me?.isReady) {
            client.party.me.setReadiness(false).catch(err => console.error(`[PARTY ERROR] Set readiness failed: ${err.message}`.red));
          }
          if (timerstatus) {
            clearTimeout(this.ID);
            timerstatus = false;
            console.log("[PARTY] Time has stopped!".yellow);
          }
        }
      };

      if (client.party.size !== 1) {
        console.log("[PARTY] Time has started!".green);
        this.ID = setTimeout(async () => {
          if (client.party) {
            await client.party.chat.send("Time expired!");
          }
          await sleep(1.2);
          client.party.leave();
          console.log("[PARTY] Left party due to party time expiring!".yellow);
          console.log("[PARTY] Time tracking stopped!".yellow);
          timerstatus = false;
        }, bot_leave_time);
        timerstatus = true;
        console.log(`Joined ${join.displayName}`.blue);
        join.party.members.forEach(member => console.log(member.displayName));
      }

      setTimeout(function(){client.party.me.setEmote(emoteEid, getCosmeticPath(emoteObj.path))},2000);
      await client.party.me.setOutfit(skinCid, undefined, undefined);
      await updateStatusAndChat();
    });

    // Party member left event
    client.on('party:member:left', async (left) => {
      if (!client.party) {
        console.log(`[PARTY ERROR] Member left but no party exists`.red);
        return;
      }

      console.log(`Member left: ${left.displayName}`.yellow);
      const partySize = client.party.size;
      if ([2, 3, 4].includes(partySize)) {
        await client.party.chat.send(`${bot_join_message}\n Join the discord: discord.gg/nexfn`);
        client.setStatus(bot_use_status, bot_use_onlinetype);
      }
      if (partySize === 1) {
        client.setStatus(bot_invite_status, bot_invite_onlinetype);
        try {
          await client.party.setPrivacy(Enums.PartyPrivacy.PRIVATE);
        } catch {
          console.log(`[PARTY] Failed to set privacy`.red);
        }
        if (client.party?.me?.isReady) {
          client.party.me.setReadiness(false).catch(err => console.error(`[PARTY ERROR] Set readiness failed: ${err.message}`.red));

        }
        if (timerstatus) {
          clearTimeout(this.ID);
          timerstatus = false;
          console.log("[PARTY] Time has stopped!".yellow);
        }
      }
    });
    // Process termination handlers
  process.on('SIGINT', async () => {
    console.log('[SHUTDOWN] Received SIGINT, disconnecting bot...'.yellow);
    client.logout();
    sleep(6);
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[SHUTDOWN] Received SIGTERM, disconnecting bot...'.yellow);
    client.logout();
    sleep(6);
    process.exit(0);
  });
  }));
})();
