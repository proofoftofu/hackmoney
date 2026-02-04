export type YellowConnectionConfig = {
  clearnodeUrl: string;
};

// NOTE: These are mocked placeholders. Replace with actual SDK functions from
// `@/experiments/yellow/index.ts` once browser-safe helpers are exposed.
export async function openChannel(_: YellowConnectionConfig): Promise<string> {
  // TODO: Sync with experiments/yellow/index.ts openChannel
  return `chn_${Math.random().toString(36).slice(2, 10)}`;
}

export async function deposit(amount: number): Promise<void> {
  // TODO: Sync with experiments/yellow/index.ts deposit
  await new Promise((resolve) => setTimeout(resolve, 400));
  console.info("Mock deposit", amount);
}

export async function withdraw(amount: number): Promise<void> {
  // TODO: Sync with experiments/yellow/index.ts withdraw
  await new Promise((resolve) => setTimeout(resolve, 400));
  console.info("Mock withdraw", amount);
}
