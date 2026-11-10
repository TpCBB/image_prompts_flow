import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PromptModal from '@/components/PromptModal';
import MobileSearch from '@/components/MobileSearch';
import { ToastProvider } from '@/contexts/ToastContext';
import type { Prompt } from '@/types';

const prompt: Prompt = { id: 42, title: 'Example', prompt: 'Draw a cat', category: 'Design', author: 'Author', mode: 'generate', created_at: '2026-11-10', prompt_type: 'image' };

describe('Modal keyboard behavior', () => {
  it('contains focus, blocks the background and restores the opener when closed', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<ToastProvider><PromptModal prompt={prompt} lang="zh" onClose={onClose} /></ToastProvider>);
    const dialog = screen.getByRole('dialog');
    const buttons = dialog.querySelectorAll('button');
    expect(document.activeElement).toBe(buttons[0]);
    expect(opener).toHaveAttribute('inert');
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(opener).not.toHaveAttribute('inert');
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).not.toBe('hidden');
    opener.remove();
  });

  it('focuses the mobile search input and closes with Escape', () => {
    const onClose = vi.fn();
    render(<MobileSearch isOpen onClose={onClose} searchQuery="" onSearchChange={vi.fn()} lang="zh" />);
    expect(screen.getByRole('textbox', { name: '搜索提示词...' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
