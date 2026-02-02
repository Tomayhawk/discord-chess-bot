class QueueManager {
    constructor() {
        this.queue = [];
    }

    add(userId, timeControl) {
        this.queue.push({ id: userId, time: timeControl });
        // Try to match
        if (this.queue.length >= 2) {
            const p1 = this.queue.shift();
            // Find compatible player
            const p2Index = this.queue.findIndex(p => p.time === p1.time);
            if (p2Index !== -1) {
                const p2 = this.queue.splice(p2Index, 1)[0];
                return [p1.id, p2.id, p1.time];
            }
            // Put p1 back if no match found
            this.queue.unshift(p1);
        }
        return null;
    }

    remove(userId) {
        this.queue = this.queue.filter(p => p.id !== userId);
    }
}
module.exports = new QueueManager();
