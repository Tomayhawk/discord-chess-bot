const { SlashCommandBuilder } = require('discord.js');
const GM = require('../managers/GameManager');
const stockfish = require('../managers/StockfishService');
const utils = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('Game actions')
        .addSubcommand(s => s.setName('resign').setDescription('Forfeit the game'))
        .addSubcommand(s => s.setName('draw').setDescription('Offer draw'))
        .addSubcommand(s => s.setName('takeback').setDescription('Request undo'))
        .addSubcommand(s => s.setName('hint').setDescription('Get a hint from Stockfish'))
        .addSubcommand(s => s.setName('export').setDescription('Get FEN and PGN of current game')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const session = GM.sessions.get(userId);

        if (!session) return interaction.reply({ content: "No active game.", ephemeral: true });

        if (sub === 'export') {
            return interaction.reply({ 
                content: `📋 **Game State**\n**FEN:** \`${session.game.fen()}\`\n**PGN:** \`${session.game.pgn()}\``, 
                ephemeral: true 
            });
        }

        if (sub === 'resign') {
            GM.sessions.delete(userId);
            if (session.black !== 'Bot') GM.sessions.delete(session.black === userId ? session.white : session.black);
            utils.updateElo(session.white, session.black, session.white === userId ? 0 : 1);
            return interaction.reply(`${interaction.user} resigned.`);
        }

        if (sub === 'draw') {
            if (session.type === 'bot') return interaction.reply("Bot declines draw.");
            return interaction.reply(`<@${session.opponentId}>, opponent offers a draw. Reply /game draw to accept.`);
        }

        if (sub === 'hint') {
            const move = await stockfish.getBestMove(session.game.fen(), 20);
            return interaction.reply({ content: `💡 Best move: **${move}**`, ephemeral: true });
        }

        if (sub === 'takeback') {
            if (session.type === 'bot') {
                session.game.undo(); session.game.undo(); 
                return interaction.reply("Takeback granted.");
            }
            return interaction.reply("Takeback request sent.");
        }
    }
};