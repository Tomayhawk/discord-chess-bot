// commands/spectate.js
const { SlashCommandBuilder } = require('discord.js');
const GM = require('../managers/GameManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spectate')
        .setDescription('Watch a game')
        .addUserOption(o => o.setName('player').setDescription('Player to watch').setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getUser('player');
        
        if (!GM.sessions.has(target.id)) {
            return interaction.reply({ content: "That user is not in a game.", ephemeral: true });
        }

        GM.addSpectator(interaction.user.id, target.id);
        await interaction.reply({ content: `👀 You are now spectating **${target.username}**! You will receive board updates via DM.` });
    }
};
