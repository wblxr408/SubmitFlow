/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../button';

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeDefined();
  });

  it('handles click event', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders with different variants', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;

    variants.forEach((variant) => {
      const { container } = render(
        <Button variant={variant}>{variant}</Button>
      );
      expect(container.firstChild).toBeDefined();
    });
  });

  it('renders disabled state', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('renders loading state', () => {
    render(
      <Button loading>
        Loading
      </Button>
    );

    expect(screen.getByRole('button')).toBeDefined();
  });

  it('renders with icon', () => {
    render(
      <Button>
        <span>Icon</span> Submit
      </Button>
    );

    expect(screen.getByText('Icon')).toBeDefined();
    expect(screen.getByText('Submit')).toBeDefined();
  });
});
