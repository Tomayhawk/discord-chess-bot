require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { Chess } = require('chess.js');
const ChessImageGenerator = require('chess-image-generator');
const fs = require('fs');
const csv = require('csv-parser');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
let puzzles = [], stats = {};
const games = new Map(), hints = new Map();

// Load Data
if (fs.existsSync('./stats.json')) stats = JSON.parse(fs.readFileSync('./stats.json'));
fs.createReadStream('puzzles.csv').pipe(csv()).on('data', r => puzzles.push({
    fen: r.FEN, solution: r.Moves.split(' '), id: r.PuzzleId, rating: r.Rating
})).on('end', () => console.log(`Loaded ${puzzles.length} puzzles.`));

const saveStats = () => fs.writeFileSync('./stats.json', JSON.stringify(stats));
const updateScore = (id, win) => {
    if (!stats[id]) stats[id] = { wins: 0, losses: 0 };
    win ? stats[id].wins++ : stats[id].losses++;
    saveStats();
};

// Chess Logic Helpers
async function sendBoard(channel, game, text, userId) {
    const ig = new ChessImageGenerator();
    ig.loadFEN(game.fen());
    const buf = await ig.generateBuffer();
    const file = new AttachmentBuilder(buf, { name: 'board.png' });
    return channel.send({ content: text, files: [file] });
}

// Bot move selection (Simple evaluation)
function getBotMove(game) {
    const moves = game.moves();
    return moves[Math.floor(Math.random() * moves.length)]; // Expand this with Minimax if desired
}

client.on('messageCreate', async m => {
    if (m.author.bot) return;
    const args = m.content.toLowerCase().split(' ');
    const cmd = args[0], userId = m.author.id;

    // Command: !leaderboard
    if (cmd === '!leaderboard') {
        const top = Object.entries(stats).sort((a, b) => b[1].wins - a[1].wins).slice(0, 5)
            .map(([id, s], i) => `${i + 1}. <@${id}>: ${s.wins}W - ${s.losses}L`).join('\n');
        return m.reply(`**Top Players:**\n${top || 'No data yet.'}`);
    }

    // Command: !play (Bot or PvP)
    if (cmd === '!play') {
        const opponent = m.mentions.users.first();
        const game = new Chess();
        games.set(userId, { game, type: opponent ? 'pvp' : 'bot', opponentId: opponent?.id });
        if (opponent) games.set(opponent.id, { game, type: 'pvp', opponentId: userId });
        
        return sendBoard(m.channel, game, `Game started! ${opponent ? `<@${opponent.id}>, your move.` : 'Your move vs Bot.'}`);
    }

    // Puzzle Mode
    if (cmd === '!puzzle') {
        const p = puzzles[Math.floor(Math.random() * puzzles.length)];
        const game = new Chess(p.fen);
        game.move(p.solution[0]); // Opponent's first move
        games.set(userId, { game, type: 'puzzle', solution: p.solution, moveIndex: 1 });
        return sendBoard(m.channel, game, `Puzzle Rating: ${p.rating}. Find the best move!`);
    }

    // Handle Moves
    const session = games.get(userId);
    if (session && !m.content.startsWith('!')) {
        const { game, type, solution, moveIndex } = session;
        try {
            const move = game.move(m.content);
            if (!move) return;

            if (type === 'puzzle') {
                if (move.lan === solution[moveIndex]) {
                    const nextIdx = moveIndex + 1;
                    if (nextIdx >= solution.length) {
                        updateScore(userId, true);
                        games.delete(userId);
                        return m.reply("Solved! 🎉");
                    }
                    game.move(solution[nextIdx]);
                    session.moveIndex = nextIdx + 1;
                    return sendBoard(m.channel, game, `Correct! Your turn again.`, userId);
                } else {
                    return m.reply("Wrong move. Try again!");
                }
            } else if (type === 'bot') {
                if (game.isGameOver()) {
                    updateScore(userId, !game.repetition);
                    games.delete(userId);
                    return m.reply("Game Over!");
                }
                game.move(getBotMove(game));
                return sendBoard(m.channel, game, `Bot played. Your move!`);
            } else if (type === 'pvp') {
                const oppId = session.opponentId;
                if (game.isGameOver()) {
                    updateScore(userId, true); updateScore(oppId, false);
                    games.delete(userId); games.delete(oppId);
                    return m.reply("Checkmate!");
                }
                return sendBoard(m.channel, game, `Move played! <@${oppId}>, your turn.`);
            }
        } catch (e) { /* Ignore invalid SAN/UCI strings */ }
    }
});

client.login(process.env.BOT_TOKEN);
