export async function safeAsync<T>(
  promise: Promise<T>,
  label: string = "SAFE_ASYNC"
): Promise<T | undefined> {
  try {
    return await promise;
  } catch (error) {
    console.log(`${label} ERROR:`, error);
    return undefined;
  }
}