const fs = require('fs');
const BoardRenderer = require('./managers/BoardRenderer');

const DB_FILE = './db.json';
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : {};

const saveDb = () => {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } 
    catch (err) { console.error("DB Save Failed", err); }
};

const getUser = (id) => {
    const user = db[id] || { r: 1500, w: 0, l: 0, d: 0, h: [], theme: 'default' };
    if (!user.theme) user.theme = 'default';
    return user;
};

const setUser = (id, data) => { db[id] = data; saveDb(); };
const getAllUsers = () => db;

const updateElo = (wId, bId, result) => { 
    const p1 = getUser(wId);
    const p2 = getUser(bId);
    const k = 32;
    const exp1 = 1 / (1 + 10 ** ((p2.r - p1.r) / 400));
    const exp2 = 1 / (1 + 10 ** ((p1.r - p2.r) / 400));

    p1.r += k * (result - exp1);
    p2.r += k * ((1 - result) - exp2);

    if (result === 1) { p1.w++; p2.l++; p1.h.push('W'); p2.h.push('L'); }
    else if (result === 0) { p1.l++; p2.w++; p1.h.push('L'); p2.h.push('W'); }
    else { p1.d++; p2.d++; p1.h.push('D'); p2.h.push('D'); }

    [p1, p2].forEach(p => { if(p.h.length > 10) p.h.shift(); });
    setUser(wId, p1); setUser(bId, p2);
    return { wNew: p1.r, bNew: p2.r };
};

// Wrapper for the renderer
const generateBoard = async (fen, theme = 'default', highlights = []) => {
    return await BoardRenderer.generate(fen, theme, highlights);
};

const getOpeningName = (fen) => {
    const common = {
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1": "King's Pawn",
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": "Open Game",
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2": "King's Knight"
    };
    return common[fen] || null;
};

const checkRoleRewards = async (guild, userId, elo) => {
    if (!guild) return;
    try {
        const member = await guild.members.fetch(userId);
        const roleMap = { 1000: 'Novice', 1500: 'Intermediate', 2000: 'Grandmaster' };
        for (const [req, name] of Object.entries(roleMap)) {
            if (elo >= parseInt(req)) {
                const role = guild.roles.cache.find(r => r.name === name);
                if (role && !member.roles.cache.has(role.id)) await member.roles.add(role);
            }
        }
    } catch (e) { console.error(e); }
};

module.exports = { getUser, setUser, getAllUsers, updateElo, generateBoard, getOpeningName, checkRoleRewards };
