/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../badge';

describe('Badge Component', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toBeDefined();
  });

  it('renders with custom variant', () => {
    render(<Badge variant="blue">Blue</Badge>);
    expect(screen.getByText('Blue')).toBeDefined();
  });

  it('renders with different variants', () => {
    const variants = ['default', 'blue', 'green', 'red', 'yellow'] as const;

    variants.forEach((variant) => {
      const { container } = render(
        <Badge variant={variant}>{variant}</Badge>
      );
      expect(container.firstChild).toBeDefined();
    });
  });
});
