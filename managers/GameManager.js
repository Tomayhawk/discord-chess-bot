const { Chess } = require('chess.js');
const utils = require('../utils');
const stockfish = require('./StockfishService');

class GameManager {
    constructor() {
        this.sessions = new Map();
        setInterval(() => this.cleanup(), 60000); // Cleanup idle games
        setInterval(() => this.checkTimers(), 1000); // Check flags
    }

    createGame(p1, p2, options = {}) {
        const game = new Chess();
        const id = p1 + '-' + Date.now();
        const session = {
            id,
            game,
            white: p1,
            black: p2,
            turn: 'w',
            type: p2 === 'Bot' ? 'bot' : 'pvp',
            timers: { w: (options.time||10) * 60 * 1000, b: (options.time||10) * 60 * 1000 },
            timeControl: options.time ? true : false,
            lastMoveTime: Date.now(),
            history: [],
            spectators: [],
            channelId: options.channelId,
            difficulty: options.difficulty || 10,
            blindfold: options.blindfold || false
        };
        
        this.sessions.set(p1, session);
        if (p2 !== 'Bot') this.sessions.set(p2, session);
        return session;
    }

    addSpectator(userId, targetId) {
        const session = this.sessions.get(targetId);
        if (session && !session.spectators.includes(userId)) {
            session.spectators.push(userId);
            return true;
        }
        return false;
    }

    async handleMove(userId, moveSan) {
        const session = this.sessions.get(userId);
        if (!session) return null;

        const isWhite = session.white === userId;
        if ((isWhite && session.game.turn() !== 'w') || (!isWhite && session.game.turn() !== 'b')) {
            return { error: "Not your turn!" };
        }

        try {
            const move = session.game.move(moveSan);
            if (!move) return { error: "Invalid move." };

            // Update Timers
            const now = Date.now();
            if (session.timeControl) {
                const elapsed = now - session.lastMoveTime;
                if (isWhite) session.timers.w -= elapsed;
                else session.timers.b -= elapsed;
            }
            session.lastMoveTime = now;
            session.history.push(move.san);

            const opening = utils.getOpeningName(session.game.fen());
            
            // Win/Draw Detection
            let gameOver = false;
            let reason = null;
            let winner = null;

            if (session.game.isGameOver()) {
                gameOver = true;
                if (session.game.isCheckmate()) {
                    reason = "Checkmate";
                    winner = session.game.turn() === 'w' ? session.black : session.white;
                } else {
                    reason = "Draw/Stalemate";
                }
            }

            // Bot Move Logic
            let botMove = null;
            if (session.type === 'bot' && !gameOver && session.game.turn() === 'b') {
                const engMove = await stockfish.getBestMove(session.game.fen(), session.difficulty);
                if (engMove) {
                    session.game.move(engMove);
                    session.history.push(engMove);
                    botMove = engMove;
                    if (session.game.isGameOver()) {
                        gameOver = true;
                        reason = session.game.isCheckmate() ? "Checkmate" : "Draw";
                        winner = session.game.isCheckmate() ? session.black : null;
                    }
                }
            }

            return { session, move, botMove, opening, gameOver, reason, winner };
        } catch (e) {
            return { error: "Move Error" };
        }
    }

    checkTimers() {
        const now = Date.now();
        this.sessions.forEach(s => {
            if (!s.timeControl || s.game.isGameOver()) return;
            const activeTimer = s.game.turn() === 'w' ? s.timers.w : s.timers.b;
            const elapsed = now - s.lastMoveTime;
            if (activeTimer - elapsed <= 0) {
                // Handle timeout (usually triggered in index.js or via event)
                s.expired = true;
            }
        });
    }

    cleanup() {
        const now = Date.now();
        this.sessions.forEach((s, k) => {
            if (now - s.lastMoveTime > 30 * 60 * 1000) this.sessions.delete(k);
        });
    }
}

module.exports = new GameManager();
