/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent } from '../card';

describe('Card Component', () => {
  it('renders card with header and content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Test Content</p>
        </CardContent>
      </Card>
    );

    expect(screen.getByText('Test Title')).toBeDefined();
    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('renders card without header', () => {
    render(
      <Card>
        <CardContent>
          <p>Content Only</p>
        </CardContent>
      </Card>
    );

    expect(screen.getByText('Content Only')).toBeDefined();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <Card className="custom-class">
        <CardContent>Custom Card</CardContent>
      </Card>
    );

    expect(container.firstChild).toBeDefined();
  });
});
