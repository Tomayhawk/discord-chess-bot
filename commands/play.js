const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const GM = require('../managers/GameManager');
const utils = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Start a chess game')
        .addUserOption(opt => opt.setName('opponent').setDescription('User to play against'))
        .addIntegerOption(opt => opt.setName('time').setDescription('Minutes per side (0 for infinite)'))
        .addStringOption(opt => opt.setName('mode').setDescription('Special modes').addChoices(
            { name: 'Standard', value: 'std' },
            { name: 'Blindfold', value: 'blind' }
        ))
        .addIntegerOption(opt => opt.setName('difficulty').setDescription('Bot difficulty (1-20)')),

    async execute(interaction) {
        const opponent = interaction.options.getUser('opponent');
        const time = interaction.options.getInteger('time') || 0;
        const mode = interaction.options.getString('mode') || 'std';
        const diff = interaction.options.getInteger('difficulty') || 10;
        const userId = interaction.user.id;

        if (GM.sessions.has(userId)) return interaction.reply({ content: "Finish your current game first!", ephemeral: true });

        const p2 = opponent ? opponent.id : 'Bot';
        const session = GM.createGame(userId, p2, {
            time, 
            blindfold: mode === 'blind',
            channelId: interaction.channelId,
            difficulty: diff
        });

        // Voice Integration check
        if (process.env.VOICE_LOG_CHANNEL) {
            const vChan = interaction.guild.channels.cache.get(process.env.VOICE_LOG_CHANNEL);
            if (vChan) vChan.send(`📢 Match Started: ${interaction.user.username} vs ${opponent ? opponent.username : 'Stockfish'}`);
        }

        const boardBuf = await utils.generateBoard(session.game.fen(), utils.getUser(userId).theme);
        
        await interaction.reply({ 
            content: `Game Started! ${mode === 'blind' ? '🙈 Blindfold Mode' : ''}`, 
            files: mode === 'blind' ? [] : [new AttachmentBuilder(boardBuf, { name: 'board.png' })]
        });
    }
};
