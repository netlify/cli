export class MultiMap<K, V> {
  private map = new Map<K, V[]>()

  add(key: K, value: V) {
    this.map.set(key, [...(this.map.get(key) ?? []), value])
  }

  get(key: K): readonly V[] {
    return this.map.get(key) ?? []
  }
}
