const { Chess } = require('chess.js');
const fs = require('fs');
const csv = require('csv-parser');

class PuzzleManager {
    constructor() {
        this.puzzles = [];
        this.activePuzzles = new Map();
        this.loadPuzzles();
    }

    loadPuzzles() {
        const results = [];
        if (fs.existsSync('puzzles.csv')) {
            fs.createReadStream('puzzles.csv')
                .pipe(csv())
                .on('data', (data) => {
                    if (data.FEN && data.Moves) {
                        results.push({
                            id: data.PuzzleId,
                            fen: data.FEN,
                            solution: data.Moves.split(' '),
                            rating: data.Rating
                        });
                    }
                })
                .on('end', () => {
                    this.puzzles = results;
                    console.log(`Loaded ${this.puzzles.length} local puzzles.`);
                });
        }
    }

    getDailyPuzzle() {
        if (this.puzzles.length === 0) return null;
        
        // MATH FOR DAILY PUZZLE
        const now = new Date();
        const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        const index = dateKey % this.puzzles.length;
        
        return this.puzzles[index];
    }

    startSession(userId, type, puzzleData) {
        if (!puzzleData) return null;

        const game = new Chess(puzzleData.fen);
        const solution = puzzleData.solution;
        
        // Auto-play the opponent's first move if necessary
        let moveIndex = 0;
        try {
            // Some puzzles start with opponent making a move
            if (solution.length > 0) {
                const testGame = new Chess(puzzleData.fen);
                const move = testGame.move(solution[0]);
                // If the first move in solution is valid, play it
                if (move) {
                    game.move(solution[0]);
                    moveIndex = 1;
                }
            }
        } catch (e) {
            // Fallback: Just load FEN
        }

        this.activePuzzles.set(userId, {
            game,
            solution,
            moveIndex, 
            type,
            score: 0,
            endTime: type === 'rush' ? Date.now() + (3 * 60 * 1000) : null
        });

        return { fen: game.fen() };
    }

    handleMove(userId, moveInput) {
        const session = this.activePuzzles.get(userId);
        if (!session) return null;

        if (session.type === 'rush' && Date.now() > session.endTime) {
            this.activePuzzles.delete(userId);
            return { finished: true, score: session.score, message: `⏰ Time's up! Score: ${session.score}` };
        }

        // CRASH FIX: Try-Catch Block
        let move;
        try {
            // Attempt to make the move
            move = session.game.move(moveInput);
            if (!move) throw new Error("Invalid");
        } catch (e) {
            // Return error object instead of crashing
            return { error: "❌ Invalid move." };
        }

        // Check against solution
        const moveUCI = move.from + move.to + (move.promotion || '');
        const correctUCI = session.solution[session.moveIndex];

        if (moveUCI === correctUCI) {
            session.moveIndex++; 

            // Puzzle Complete?
            if (session.moveIndex >= session.solution.length) {
                if (session.type === 'rush') {
                    session.score++;
                    // Load random next puzzle
                    const next = this.puzzles[Math.floor(Math.random() * this.puzzles.length)];
                    return this.reloadRush(session, next);
                } else {
                    this.activePuzzles.delete(userId);
                    return { finished: true, correct: true, message: "🎉 Correct! Puzzle Solved!", fen: session.game.fen() };
                }
            }

            // Opponent Response
            const opponentMove = session.solution[session.moveIndex];
            session.game.move(opponentMove);
            session.moveIndex++;

            return { 
                correct: true, 
                fen: session.game.fen(), 
                message: "✅ Correct! Opponent plays " + opponentMove 
            };
        } else {
            session.game.undo(); // Undo wrong move
            if (session.type === 'rush') {
                this.activePuzzles.delete(userId);
                return { finished: true, score: session.score, message: `❌ Wrong move! Game Over.` };
            }
            return { error: "❌ Wrong move, try again!" };
        }
    }

    reloadRush(session, puzzleData) {
        if (!puzzleData) return { finished: true, message: "No more puzzles!" };
        
        session.game = new Chess(puzzleData.fen);
        session.solution = puzzleData.solution;
        session.moveIndex = 0;
        
        // Try auto-play first move
        try {
             if (session.game.move(session.solution[0])) {
                 session.moveIndex = 1;
             }
        } catch(e) { 
            session.game.load(puzzleData.fen); 
        }

        return { 
            solved: true, 
            score: session.score, 
            fen: session.game.fen(), 
            message: "✅ Correct! Next puzzle..." 
        };
    }
}

module.exports = new PuzzleManager();
