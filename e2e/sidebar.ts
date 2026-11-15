import type { Page } from '@playwright/test';

/** The side panel keeps its tools behind "More" (D-157); open it unless it already is. */
export async function openMore(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'More', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}
