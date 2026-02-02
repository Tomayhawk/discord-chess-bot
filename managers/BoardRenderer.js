const { createCanvas, loadImage } = require('canvas');

const BASE_URL = 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/';

const ASSET_URLS = {
    // FEN 'p' (Black Pawn) -> 'bp.png'
    p: BASE_URL + 'bp.png',
    n: BASE_URL + 'bn.png',
    b: BASE_URL + 'bb.png',
    r: BASE_URL + 'br.png',
    q: BASE_URL + 'bq.png',
    k: BASE_URL + 'bk.png',

    // FEN 'P' (White Pawn) -> 'wp.png'
    P: BASE_URL + 'wp.png',
    N: BASE_URL + 'wn.png',
    B: BASE_URL + 'wb.png',
    R: BASE_URL + 'wr.png',
    Q: BASE_URL + 'wq.png',
    K: BASE_URL + 'wk.png'
};

class BoardRenderer {
    constructor() {
        this.pieceCache = {};
        this.loaded = false;
        this.loadAssets();
    }

    async loadAssets() {
        if (this.loaded) return;
        console.log("🎨 Loading PNG chess assets...");
        try {
            const promises = Object.entries(ASSET_URLS).map(async ([key, url]) => {
                // PNGs load natively in Canvas without special patching
                this.pieceCache[key] = await loadImage(url);
            });
            await Promise.all(promises);
            this.loaded = true;
            console.log("✅ Chess assets loaded successfully.");
        } catch (e) {
            console.error("❌ Failed to load chess assets:", e.message);
        }
    }

    async generate(fen, theme = 'default', highlights = []) {
        if (!this.loaded) await this.loadAssets();

        const size = 512;
        const squareSize = size / 8;
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        const themes = {
            wood: { light: '#F0D9B5', dark: '#B58863' },
            green: { light: '#EEEED2', dark: '#769656' },
            icy: { light: '#DAE9F4', dark: '#94BBD0' },
            default: { light: '#DEE3E6', dark: '#8CA2AD' }
        };
        const colors = themes[theme] || themes.default;

        // Draw Board (Opaque Background)
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const isLight = (row + col) % 2 === 0;
                ctx.fillStyle = isLight ? colors.light : colors.dark;
                ctx.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
                
                // Draw Highlights
                const squareName = String.fromCharCode(97 + col) + (8 - row);
                if (highlights.includes(squareName)) {
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; 
                    ctx.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
                }
            }
        }

        // Draw Pieces
        const fenBoard = fen.split(' ')[0];
        let row = 0;
        let col = 0;

        for (let i = 0; i < fenBoard.length; i++) {
            const char = fenBoard[i];
            if (char === '/') {
                row++;
                col = 0;
            } else if (isDigit(char)) {
                col += parseInt(char);
            } else {
                const pieceImg = this.pieceCache[char];
                if (pieceImg) {
                    ctx.drawImage(pieceImg, col * squareSize, row * squareSize, squareSize, squareSize);
                }
                col++;
            }
        }

        return canvas.toBuffer();
    }
}

function isDigit(c) {
    return c >= '0' && c <= '9';
}

module.exports = new BoardRenderer();
