export class MinHeap<T> {
  readonly #values: T[] = [];
  readonly #compare: (left: T, right: T) => number;

  constructor(compare: (left: T, right: T) => number) {
    this.#compare = compare;
  }

  get size(): number {
    return this.#values.length;
  }

  push(value: T): void {
    const values = this.#values;
    values.push(value);
    let index = values.length - 1;
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      const parent = values[parentIndex];
      if (parent === undefined || this.#compare(parent, value) <= 0) break;
      values[index] = parent;
      index = parentIndex;
    }
    values[index] = value;
  }

  pop(): T | undefined {
    const values = this.#values;
    const root = values[0];
    const last = values.pop();
    if (root === undefined) return undefined;

    if (values.length > 0 && last !== undefined) {
      let index = 0;
      while (true) {
        const leftIndex = index * 2 + 1;
        const rightIndex = leftIndex + 1;
        if (leftIndex >= values.length) break;
        const left = values[leftIndex];
        const right = values[rightIndex];
        if (left === undefined) break;
        const childIndex =
          right !== undefined && this.#compare(right, left) < 0
            ? rightIndex
            : leftIndex;
        const child = values[childIndex];
        if (child === undefined || this.#compare(child, last) >= 0) break;
        values[index] = child;
        index = childIndex;
      }
      values[index] = last;
    }
    return root;
  }
}

