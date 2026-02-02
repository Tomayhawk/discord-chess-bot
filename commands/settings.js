// commands/settings.js
const { SlashCommandBuilder } = require('discord.js');
const utils = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('User settings')
        .addSubcommand(s => s.setName('theme').setDescription('Set board theme')
            .addStringOption(o => o.setName('style').setDescription('Select theme')
                .addChoices(
                    { name: 'Classic Wood', value: 'wood' },
                    { name: 'Chess Green', value: 'green' },
                    { name: 'Icy Sea', value: 'icy' },
                    { name: 'Default Blue', value: 'default' }
                ).setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const user = utils.getUser(userId);

        if (sub === 'theme') {
            const theme = interaction.options.getString('style');
            user.theme = theme;
            utils.setUser(userId, user);
            
            // Generate preview
            const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
            const board = await utils.generateBoard(fen, theme);
            
            await interaction.reply({ 
                content: `🎨 Theme set to **${theme}**!`,
                files: [{ attachment: board, name: 'preview.png' }]
            });
        }
    }
};
