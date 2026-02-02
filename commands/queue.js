// commands/queue.js
const { SlashCommandBuilder } = require('discord.js');
const QM = require('../managers/QueueManager');
const GM = require('../managers/GameManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Find a match')
        .addIntegerOption(o => o.setName('time').setDescription('Time control (minutes)').setRequired(true))
        .addStringOption(o => o.setName('action').setDescription('Join or Leave').addChoices(
            { name: 'Join Queue', value: 'join' },
            { name: 'Leave Queue', value: 'leave' }
        )),

    async execute(interaction) {
        const time = interaction.options.getInteger('time');
        const action = interaction.options.getString('action') || 'join';
        const userId = interaction.user.id;

        if (action === 'leave') {
            QM.remove(userId);
            return interaction.reply("Removed from queue.");
        }

        const match = QM.add(userId, time);
        if (match) {
            const [p1, p2, t] = match;
            const session = GM.createGame(p1, p2, { time: t, channelId: interaction.channelId });
            
            // Notify both
            await interaction.reply(`⚔️ Match Found! <@${p1}> vs <@${p2}> (${t} min)`);
            if (p1 !== userId) {
                // If the other player is in a different interaction/channel, you might need a global announce
                // For now, assuming same channel or rely on @mention
            }
        } else {
            await interaction.reply({ content: `🕒 Added to **${time} min** queue. Waiting for opponent...`, ephemeral: true });
        }
    }
};
