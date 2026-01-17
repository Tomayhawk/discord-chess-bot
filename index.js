require('dotenv').config();
const { Client, AttachmentBuilder } = require('discord.js');
const { Chess } = require('chess.js');
const ChGen = require('chess-image-generator');
const fs = require('fs');
const client = new Client({ intents: [32767] });
let puz = [], db = JSON.parse(fs.existsSync('./db.json') ? fs.readFileSync('./db.json') : '{}');
const sessions = new Map(), save = () => fs.writeFileSync('./db.json', JSON.stringify(db));

require('csv-parser')().on('data', r => puz.push({f:r.FEN, s:r.Moves.split(' '), r:r.Rating}));
const elo = (wId, lId, draw) => {
    const s1 = db[wId] ||= {r:1500, w:0, l:0, h:[]}, s2 = db[lId] ||= {r:1500, w:0, l:0, h:[]};
    const exp = 1 / (1 + 10 ** ((s2.r - s1.r) / 400)), k = 32, sc = draw ? 0.5 : 1;
    s1.r += k * (sc - exp); s2.r += k * ((1 - sc) - (1 - exp));
    if(!draw) { s1.w++; s2.l++; s1.h.push('W'); s2.h.push('L'); } save();
};

const draw = async (ch, g, msg) => {
    const ig = new ChGen({size:400}); ig.loadFEN(g.fen());
    return ch.send({ content: msg, files: [new AttachmentBuilder(await ig.generateBuffer(), {name:'b.png'})] });
};

setInterval(() => sessions.forEach((v, k) => (Date.now() - v.t > 1.8e6) && sessions.delete(k)), 6e5);

client.on('messageCreate', async m => {
    if (m.author.bot) return;
    const [c, ...a] = m.content.toLowerCase().split(' '), id = m.author.id, s = sessions.get(id);

    if (c === '!play') {
        const o = m.mentions.users.first(), g = new Chess();
        sessions.set(id, { g, type: o ? 'pvp' : 'bot', oid: o?.id || 'Bot', t: Date.now() });
        if (o) sessions.set(o.id, { g, type: 'pvp', oid: id, t: Date.now() });
        return draw(m.channel, g, `Match: <@${id}> vs ${o ?? 'Bot'}`);
    }

    if (c === '!puzzle' || c === '!daily') {
        const d = c === '!daily' ? (await (await fetch('https://lichess.org/api/puzzle/daily')).json()).puzzle : puz[Math.floor(Math.random() * puz.length)];
        const g = new Chess(d.fen || d.f), sol = d.solution || d.s; g.move(sol[0]);
        return sessions.set(id, { g, type: 'puz', sol, i: 1, t: Date.now() }), draw(m.channel, g, `Rating: ${d.rating || d.r}`);
    }

    if (c === '!stats') {
        const u = db[m.mentions.users.first()?.id || id] || {r:1500, w:0, l:0, h:[]};
        return m.reply(`Elo: **${Math.round(u.r)}** | ${u.w}W-${u.l}L\nHistory: ${u.h.slice(-5).join(',')}`);
    }

    if (s && !m.content.startsWith('!')) {
        try {
            const move = s.g.move(m.content); if (!move) return;
            s.t = Date.now(); // Reset activity timer
            if (s.type === 'puz') {
                if (move.lan !== s.sol[s.i]) return m.reply("❌");
                if (++s.i >= s.sol.length) return sessions.delete(id), m.reply("Solved! 🎉");
                s.g.move(s.sol[s.i++]); return draw(m.channel, s.g, "Correct!");
            }
            if (s.g.isGameOver()) {
                if (s.oid !== 'Bot') elo(id, s.oid, s.g.isDraw());
                return sessions.delete(id), s.oid && sessions.delete(s.oid), m.reply(`GameOver! https://lichess.org/analysis/${s.g.fen()}`);
            }
            if (s.type === 'bot') s.g.move(s.g.moves().sort((a,b) => (s.g.move(b), s.g.undo(), 1))[0]);
            return draw(m.channel, s.g, s.type === 'bot' ? "Bot move..." : `<@${s.oid}>'s turn`);
        } catch(e) {}
    }
    if (['!fen', '!pgn', '!help'].includes(c)) return m.reply(c === '!help' ? "Commands: `!play`, `!puzzle`, `!daily`, `!stats`, `!leaderboard`" : `\`${s?.g[c.slice(1)]()}\``);
});
client.login(process.env.BOT_TOKEN);
