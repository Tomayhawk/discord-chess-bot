require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { Chess } = require('chess.js');
const ChessImageGenerator = require('chess-image-generator');
const fs = require('fs');
const csv = require('csv-parser');

// --- CONFIGURATION & STATE ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const DB_FILE = './db.json';
const PUZZLE_FILE = './puzzles.csv';
const sessions = new Map(); // Stores active games: key=userId, value=GameObject
let puzzles = [];

// --- DATA PERSISTENCE ---
// Load or initialize Database
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : {};

const saveDb = () => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error("Failed to save DB:", err);
    }
};

// Load Puzzles asynchronously
if (fs.existsSync(PUZZLE_FILE)) {
    fs.createReadStream(PUZZLE_FILE)
        .pipe(csv())
        .on('data', (row) => {
            // Adjust keys based on your specific CSV header format
            puzzles.push({ fen: row.FEN, moves: row.Moves.split(' '), rating: row.Rating });
        })
        .on('end', () => console.log(`Loaded ${puzzles.length} puzzles.`));
}

// --- HELPER FUNCTIONS ---

// Update ELO ratings
const updateElo = (winnerId, loserId, isDraw) => {
    const defaultStats = { r: 1500, w: 0, l: 0, h: [] };
    const p1 = db[winnerId] || { ...defaultStats, h: [] };
    const p2 = db[loserId] || { ...defaultStats, h: [] };

    // Calculate expected score
    const expected = 1 / (1 + 10 ** ((p2.r - p1.r) / 400));
    const k = 32;
    const score = isDraw ? 0.5 : 1;

    // Update Ratings
    p1.r += k * (score - expected);
    p2.r += k * ((1 - score) - (1 - expected));

    // Update History & Stats
    if (!isDraw) {
        p1.w++; p2.l++;
        p1.h.push('W'); p2.h.push('L');
    } else {
        p1.h.push('D'); p2.h.push('D');
    }

    // Keep history trimmed to last 10 games
    if (p1.h.length > 10) p1.h.shift();
    if (p2.h.length > 10) p2.h.shift();

    db[winnerId] = p1;
    db[loserId] = p2;
    saveDb();
};

// Generate and send board image
const sendBoard = async (channel, game, messageText) => {
    const imageGen = new ChessImageGenerator({ size: 480 });
    imageGen.loadFEN(game.fen());
    const buffer = await imageGen.generateBuffer();
    
    await channel.send({
        content: messageText,
        files: [new AttachmentBuilder(buffer, { name: 'board.png' })]
    });
};

// Cleanup old sessions (30 mins inactivity)
setInterval(() => {
    const now = Date.now();
    sessions.forEach((session, userId) => {
        if (now - session.lastActivity > 30 * 60 * 1000) {
            sessions.delete(userId);
        }
    });
}, 10 * 60 * 1000);

// --- COMMAND HANDLERS ---

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // Parse command
    const args = msg.content.trim().split(/\s+/);
    const command = args[0].toLowerCase();
    const userId = msg.author.id;
    const session = sessions.get(userId);

    // 1. PLAY COMMAND
    if (command === '!play') {
        if (session) return msg.reply("You already have a game in progress!");
        
        const opponent = msg.mentions.users.first();
        const game = new Chess();
        const gameData = { game, type: opponent ? 'pvp' : 'bot', opponentId: opponent?.id || 'Bot', lastActivity: Date.now() };

        sessions.set(userId, gameData);
        if (opponent) {
            sessions.set(opponent.id, { ...gameData, opponentId: userId }); // Link opponent
        }

        return sendBoard(msg.channel, game, `Match Started: <@${userId}> vs ${opponent ? `<@${opponent.id}>` : 'Bot'}`);
    }

    // 2. PUZZLE COMMANDS
    if (command === '!puzzle' || command === '!daily') {
        let puzzleData;

        if (command === '!daily') {
            try {
                const response = await fetch('https://lichess.org/api/puzzle/daily');
                const data = await response.json();
                puzzleData = { fen: data.puzzle.fen, moves: data.puzzle.solution, rating: data.puzzle.rating };
            } catch (e) {
                return msg.reply("Failed to fetch daily puzzle.");
            }
        } else {
            if (puzzles.length === 0) return msg.reply("No local puzzles loaded.");
            puzzleData = puzzles[Math.floor(Math.random() * puzzles.length)];
        }

        const game = new Chess(puzzleData.fen);
        // Apply opponent's first move (if puzzle starts mid-sequence)
        // Note: Lichess daily usually starts with the opponent moving into the puzzle state.
        // We assume 'moves' array starts with the move the player must make, OR the move leading into it.
        // Logic here assumes 'moves' contains the FULL sequence required to solve.
        
        sessions.set(userId, { 
            game, 
            type: 'puzzle', 
            solution: puzzleData.moves, 
            step: 0, 
            lastActivity: Date.now() 
        });

        return sendBoard(msg.channel, game, `Puzzle Rating: ${puzzleData.rating || '?'}`);
    }

    // 3. STATS COMMAND
    if (command === '!stats') {
        const targetId = msg.mentions.users.first()?.id || userId;
        const userStats = db[targetId] || { r: 1500, w: 0, l: 0, h: [] };
        
        return msg.reply(
            `📊 **Stats**\nElo: **${Math.round(userStats.r)}**\nRecord: ${userStats.w}W - ${userStats.l}L\nRecent: ${userStats.h.join(' ')}`
        );
    }

    // 4. LEADERBOARD COMMAND
    if (command === '!leaderboard') {
        const sorted = Object.entries(db)
            .sort(([, a], [, b]) => b.r - a.r)
            .slice(0, 10); // Top 10

        const board = sorted.map((entry, i) => {
            const [uid, stat] = entry;
            return `${i + 1}. <@${uid}> - **${Math.round(stat.r)}**`;
        }).join('\n');

        return msg.channel.send(`🏆 **Leaderboard**\n${board || "No stats recorded yet."}`);
    }

    // 5. GAME INPUT HANDLER (Algebraic Notation)
    if (session && !msg.content.startsWith('!')) {
        try {
            const moveInput = msg.content.toLowerCase();
            const move = session.game.move(moveInput); // Returns null if invalid

            if (!move) return; // Ignore invalid chat messages
            
            session.lastActivity = Date.now();

            // Handle Puzzle Move
            if (session.type === 'puzzle') {
                const expectedMove = session.solution[session.step];
                
                // Compare standard LAN or SAN
                if (move.lan !== expectedMove && move.san !== expectedMove) {
                    session.game.undo(); // Undo invalid try
                    return msg.reply("❌ Incorrect move.");
                }

                session.step++;
                if (session.step >= session.solution.length) {
                    sessions.delete(userId);
                    return msg.reply("🎉 Solved!");
                }
                
                // Bot plays next move in puzzle
                session.game.move(session.solution[session.step++]);
                return sendBoard(msg.channel, session.game, "Correct! Next move...");
            }

            // Check Game Over (Checkmate/Draw)
            if (session.game.isGameOver()) {
                const isDraw = session.game.isDraw();
                const resultMsg = isDraw ? "Draw!" : "Checkmate!";
                
                if (session.type === 'pvp') {
                    updateElo(userId, session.opponentId, isDraw);
                }

                sessions.delete(userId);
                if (session.opponentId && session.opponentId !== 'Bot') sessions.delete(session.opponentId);
                
                return msg.reply(`🏁 **Game Over** - ${resultMsg}\nAnalysis: https://lichess.org/analysis/${session.game.fen().replace(/ /g, '_')}`);
            }

            // Handle Bot Move (PvE)
            if (session.type === 'bot') {
                const possibleMoves = session.game.moves();
                const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                session.game.move(randomMove);
                
                // Check if Bot won
                 if (session.game.isGameOver()) {
                    sessions.delete(userId);
                    return msg.reply(`🤖 **Bot Wins!**\nAnalysis: https://lichess.org/analysis/${session.game.fen().replace(/ /g, '_')}`);
                }
                
                return sendBoard(msg.channel, session.game, "Bot played. Your turn.");
            }

            // Handle PvP Turn Switch
            if (session.type === 'pvp') {
                return sendBoard(msg.channel, session.game, `<@${session.opponentId}>'s turn`);
            }

        } catch (e) {
            console.error(e);
        }
    }
    
    // Help Command
    if (command === '!help') {
        msg.reply("Commands: `!play [@user]`, `!puzzle`, `!daily`, `!stats`, `!leaderboard`, `!fen`, `!pgn`");
    }
    
    // Utilities
    if (command === '!fen' && session) msg.reply(`\`${session.game.fen()}\``);
    if (command === '!pgn' && session) msg.reply(`\`${session.game.pgn()}\``);
});

client.login(process.env.BOT_TOKEN);
