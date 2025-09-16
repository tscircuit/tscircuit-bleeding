export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  iterator: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (concurrency < 1) {
    throw new Error("Concurrency must be at least 1");
  }

  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const runNext = async (): Promise<void> => {
    const index = currentIndex;
    if (index >= items.length) {
      return;
    }
    currentIndex += 1;
    const value = await iterator(items[index]!, index);
    results[index] = value;
    await runNext();
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}
