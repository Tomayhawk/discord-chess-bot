class TournamentManager {
    constructor() {
        this.tournaments = new Map(); // guildId -> { players: [], round: 0, matches: [] }
    }

    create(guildId) {
        this.tournaments.set(guildId, { state: 'reg', players: [], matches: [] });
    }

    join(guildId, userId) {
        const t = this.tournaments.get(guildId);
        if (t && t.state === 'reg' && !t.players.includes(userId)) {
            t.players.push(userId);
            return true;
        }
        return false;
    }

    start(guildId) {
        const t = this.tournaments.get(guildId);
        if (!t || t.players.length < 2) return null;
        t.state = 'active';
        // Simple Swiss/Random pairing
        const pairings = [];
        const shuffled = [...t.players].sort(() => 0.5 - Math.random());
        while(shuffled.length >= 2) {
            pairings.push([shuffled.pop(), shuffled.pop()]);
        }
        t.matches = pairings;
        return pairings;
    }
}
module.exports = new TournamentManager();
