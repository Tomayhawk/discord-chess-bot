const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const utils = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show top 10 players'),

    async execute(interaction) {
        const allUsers = utils.getAllUsers();
        const sorted = Object.entries(allUsers)
            .sort(([, a], [, b]) => b.r - a.r) // Sort by Rating Descending
            .slice(0, 10);

        const embed = new EmbedBuilder()
            .setTitle("🏆 Chess Leaderboard")
            .setColor(0xFFD700);

        let desc = "";
        for (const [i, [id, data]] of sorted.entries()) {
            const user = await interaction.client.users.fetch(id).catch(() => null);
            const name = user ? user.username : "Unknown";
            desc += `**${i + 1}.** ${name} - **${Math.floor(data.r)}** Elo (W:${data.w}/L:${data.l})\n`;
        }

        embed.setDescription(desc || "No ranked players yet.");
        await interaction.reply({ embeds: [embed] });
    }
};
