const { spawn } = require('child_process');

class StockfishService {
    constructor() {
        this.enginePath = process.env.STOCKFISH_PATH || 'stockfish'; 
    }

    getBestMove(fen, difficulty = 10) {
        return new Promise((resolve) => {
            try {
                const engine = spawn(this.enginePath);
                let bestMove = '';

                engine.stdout.on('data', (data) => {
                    const line = data.toString();
                    if (line.includes('bestmove')) {
                        bestMove = line.split(' ')[1];
                        engine.kill();
                        resolve(bestMove);
                    }
                });

                engine.stdin.write(`uci\nsetoption name Skill Level value ${difficulty}\nposition fen ${fen}\ngo movetime 1000\n`);
            } catch (e) {
                // Fallback to random if no engine found
                resolve(null); 
            }
        });
    }
}

module.exports = new StockfishService();
