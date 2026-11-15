import { fireEvent, screen } from '@testing-library/react';

/** The side panel keeps its tools behind "More" (D-157): open it, once, if it is not open yet. */
export async function openMore(): Promise<void> {
  const toggle = await screen.findByRole('button', { name: 'More' });
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
}
