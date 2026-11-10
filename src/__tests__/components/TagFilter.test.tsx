import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TagFilter from '@/components/TagFilter';

const tags = Array.from({ length: 20 }, (_, index) => ({ id: String(index), slug: `tag-${index}`, name_zh: `标签${index}`, name_en: `Tag ${index}`, count: 20 - index }));

describe('All tag access', () => {
  it('lets visitors find and select tags outside the popular fifteen', () => {
    const onSelect = vi.fn();
    render(<TagFilter tags={tags} lang="zh" selectedTag={null} onTagSelect={onSelect} />);
    expect(screen.queryByText('标签19')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '展开全部 20 个标签' }));
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索标签' }), { target: { value: 'Tag 19' } });
    fireEvent.click(screen.getByRole('button', { name: '标签19(1)' }));
    expect(onSelect).toHaveBeenCalledWith('tag-19');
    expect(screen.queryByText('标签0')).not.toBeInTheDocument();
  });

  it('keeps a selected low-frequency tag available after collapsing', () => {
    render(<TagFilter tags={tags} lang="zh" selectedTag="tag-19" onTagSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: '标签19(1)' })).toHaveAttribute('aria-pressed', 'true');
  });
});
