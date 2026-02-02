const { SlashCommandBuilder } = require('discord.js');
const TM = require('../managers/TournamentManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tournament')
        .setDescription('Manage tournaments')
        .addSubcommand(s => s.setName('create').setDescription('Create a new tournament lobby'))
        .addSubcommand(s => s.setName('join').setDescription('Join the current tournament'))
        .addSubcommand(s => s.setName('start').setDescription('Start the tournament (Admin only)')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'create') {
            TM.create(guildId);
            return interaction.reply("🏆 Tournament Lobby Created! Type `/tournament join` to enter.");
        }

        if (sub === 'join') {
            const success = TM.join(guildId, interaction.user.id);
            if (success) return interaction.reply(`${interaction.user} joined the tournament!`);
            return interaction.reply({ content: "Could not join (Lobby full or not created).", ephemeral: true });
        }

        if (sub === 'start') {
            const pairings = TM.start(guildId);
            if (!pairings) return interaction.reply("Not enough players or no lobby.");
            
            let msg = "📣 **Tournament Started! Round 1 Pairings:**\n";
            pairings.forEach(p => msg += `<@${p[0]}> vs <@${p[1]}>\n`);
            msg += "\n*Use `/play opponent:@User` to start your match!*";
            return interaction.reply(msg);
        }
    }
};
