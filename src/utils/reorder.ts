// ドラッグ&ドロップ(v2.1)用の並び替えユーティリティ。純粋関数のみ、状態やRepositoryには触れない。

export function sortByOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * othersSorted(移動対象を除いた、sortOrder昇順の兄弟配列)に moved を beforeId の直前に挿入した
 * 新しい配列を返す。beforeId が null なら末尾に追加。
 * beforeId が othersSorted 内に見つからない場合は末尾に追加する(フォールバック)。
 */
export function computeNewOrder<T extends { id: string }>(
  othersSorted: T[],
  moved: T,
  beforeId: string | null
): T[] {
  const arr = [...othersSorted];
  if (beforeId === null) {
    arr.push(moved);
    return arr;
  }
  const idx = arr.findIndex((item) => item.id === beforeId);
  if (idx === -1) {
    arr.push(moved);
    return arr;
  }
  arr.splice(idx, 0, moved);
  return arr;
}
