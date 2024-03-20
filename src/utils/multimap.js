export class MultiMap {
    constructor() {
        this.map = new Map();
    }
    add(key, value) {
        this.map.set(key, [...(this.map.get(key) ?? []), value]);
    }
    get(key) {
        return this.map.get(key) ?? [];
    }
}
