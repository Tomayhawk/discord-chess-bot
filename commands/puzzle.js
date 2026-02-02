const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const PM = require('../managers/PuzzleManager');
const utils = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('puzzle')
        .setDescription('Chess Puzzles')
        .addSubcommand(s => s.setName('daily').setDescription('Solve the daily local puzzle'))
        .addSubcommand(s => s.setName('rush').setDescription('Speed run mode')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        await interaction.deferReply();

        let puzzle = null;

        if (sub === 'daily') {
            puzzle = PM.getDailyPuzzle();
            if (!puzzle) return interaction.editReply("No local puzzles available. Please check puzzles.csv.");
            
            const startData = PM.startSession(userId, 'daily', puzzle);
            
            const board = await utils.generateBoard(startData.fen, utils.getUser(userId).theme);
            await interaction.editReply({ 
                content: `🧩 **Daily Puzzle** (Rating: ${puzzle.rating})\nWhite to move (or Black if flipped).`, 
                files: [new AttachmentBuilder(board, { name: 'puzzle.png' })] 
            });
        }
        else if (sub === 'rush') {
            // Pick random start
            puzzle = PM.puzzles[Math.floor(Math.random() * PM.puzzles.length)];
            if (!puzzle) return interaction.editReply("No puzzles loaded.");

            const startData = PM.startSession(userId, 'rush', puzzle);
            const board = await utils.generateBoard(startData.fen, utils.getUser(userId).theme);
            await interaction.editReply({ 
                content: "⚡ **Puzzle Rush!** You have 3 minutes. Go!", 
                files: [new AttachmentBuilder(board, { name: 'rush.png' })] 
            });
        }
    }
};
