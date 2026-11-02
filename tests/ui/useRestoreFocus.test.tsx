import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRestoreFocus } from '@/ui/shell/useRestoreFocus';

function Dialog({ onClose }: { readonly onClose: () => void }) {
  useRestoreFocus();
  return (
    <div role="dialog">
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  );
}

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        opener
      </button>
      <button type="button">other</button>
      {open && <Dialog onClose={() => setOpen(false)} />}
    </>
  );
}

describe('useRestoreFocus', () => {
  afterEach(cleanup);

  it('puts focus back on the button that opened the dialog', () => {
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole('button', { name: 'close' });
    close.focus();
    fireEvent.click(close);
    expect(document.activeElement).toBe(opener);
  });

  it('leaves focus alone when the person moved it somewhere else', () => {
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    fireEvent.click(opener);
    screen.getByRole('button', { name: 'other' }).focus();
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'other' }));
  });

  it('does nothing when the opener is gone', () => {
    const { rerender } = render(<Page />);
    rerender(<Page />);
    expect(document.activeElement).toBe(document.body);
  });
});
