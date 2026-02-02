require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const utils = require('./utils');
const GM = require('./managers/GameManager');
const PM = require('./managers/PuzzleManager'); 

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages]
});

// Load Commands
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const commandsPayload = [];
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    commandsPayload.push(command.data.toJSON());
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsPayload });
        console.log('Slash commands registered.');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); } catch (e) { console.error(e); }
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // CRASH PREVENTION
    // Ignore messages that start with '/' so the bot doesn't think they are chess moves
    if (msg.content.startsWith('/')) return;

    // PUZZLE HANDLING
    if (PM.activePuzzles.has(msg.author.id)) {
        const result = PM.handleMove(msg.author.id, msg.content.trim());
        if (!result) return;
        
        if (result.error) {
            // React with X but do NOT crash
            try { await msg.react('❌'); } catch (e) {}
            return;
        }
        
        if (result.finished) {
            let reply = result.message;
            if (result.fen) {
                const board = await utils.generateBoard(result.fen, utils.getUser(msg.author.id).theme);
                msg.reply({ content: reply, files: [new AttachmentBuilder(board)] });
            } else {
                msg.reply(reply);
            }
            return;
        }
        
        if (result.correct || result.solved) {
            await msg.react('✅');
            if (result.fen) {
                 const board = await utils.generateBoard(result.fen, utils.getUser(msg.author.id).theme);
                 msg.channel.send({ content: result.message || "Next move...", files: [new AttachmentBuilder(board)] });
            }
        }
        return;
    }

    // GAME MOVE HANDLING
    const session = GM.sessions.get(msg.author.id);
    if (session && msg.channel.id === session.channelId) {
        // Move Validation
        const result = await GM.handleMove(msg.author.id, msg.content.trim());
        
        if (!result || result.error) return; 
        
        const userSettings = utils.getUser(msg.author.id);
        const boardBuf = await utils.generateBoard(session.game.fen(), userSettings.theme, 
            [result.move.from, result.move.to] 
        );
        const file = new AttachmentBuilder(boardBuf, { name: 'move.png' });

        let content = `**Move:** ${result.move.san}`;
        if (result.botMove) content += ` | **Bot:** ${result.botMove}`;
        
        if (result.gameOver) {
            content += `\n🏁 **Game Over!** ${result.reason}.`;
            if (result.winner) {
                content += ` Winner: <@${result.winner}>`;
                utils.updateElo(session.white, session.black, result.winner === session.white ? 1 : 0);
            } else {
                utils.updateElo(session.white, session.black, 0.5);
            }
            GM.sessions.delete(session.white);
            if (session.black !== 'Bot') GM.sessions.delete(session.black);
        }

        await msg.channel.send({ content, files: session.blindfold ? [] : [file] });

        // Spectator Updates
        if (session.spectators.length > 0 && !session.blindfold) {
            session.spectators.forEach(specId => {
                client.users.send(specId, { content: `👀 Update: ${result.move.san}`, files: [file] }).catch(()=>{});
            });
        }
    }
});

client.login(process.env.BOT_TOKEN);
