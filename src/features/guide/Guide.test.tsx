// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Guide } from './Guide';
import { GLOSSARY, GUIDE_SECTIONS } from '../../lib/glossary';

describe('Guide', () => {
  it('gives every glossary term the anchor its tooltip links to', () => {
    // InfoTip sends people to /guide#term-<key>. If a term has no anchor here, that link
    // drops the reader at the top of the page with no idea what they were promised.
    const { container } = render(<Guide />);
    for (const key of Object.keys(GLOSSARY)) {
      expect(container.querySelector(`#term-${key}`), key).not.toBeNull();
    }
  });

  it('renders every section, each reachable from the contents', () => {
    const { container } = render(<Guide />);
    const contents = within(screen.getByRole('navigation', { name: /contents/i }));
    for (const section of GUIDE_SECTIONS) {
      expect(container.querySelector(`#${section.id}`), section.id).not.toBeNull();
      expect(contents.getByRole('link', { name: section.title })).toHaveAttribute(
        'href',
        `#${section.id}`,
      );
    }
  });

  it('walks through the four tasks that are actually built', () => {
    render(<Guide />);
    const tasks = document.getElementById('tasks')!;
    expect(within(tasks).getByText(/find what needs attention/i)).toBeInTheDocument();
    expect(within(tasks).getByText(/review and fix a document/i)).toBeInTheDocument();
    expect(within(tasks).getByText(/handle a failure/i)).toBeInTheDocument();
    expect(within(tasks).getByText(/upload a batch/i)).toBeInTheDocument();
  });
});
