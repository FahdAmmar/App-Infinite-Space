# Testing Patterns Reference (JavaScript/TypeScript) (continued)

> Second half of [`testing-patterns.md`](testing-patterns.md).

## React/Component Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('TaskForm', () => {
  it('submits the form with entered data', async () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} />);

    // Find elements by accessible role/label (not test IDs)
    await screen.findByRole('textbox', { name: /title/i });
    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'New Task' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ title: 'New Task' });
    });
  });

  it('shows validation error for empty title', async () => {
    render(<TaskForm onSubmit={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
  });
});
```

## API / Integration Testing

```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('POST /api/tasks', () => {
  it('creates a task and returns 201', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test Task' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      title: 'Test Task',
      status: 'pending',
    });
  });

  it('returns 422 for invalid input', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: '' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without authentication', async () => {
    await request(app)
      .post('/api/tasks')
      .send({ title: 'Test' })
      .expect(401);
  });
});
```

## E2E Testing (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('user can create and complete a task', async ({ page }) => {
  // Navigate and authenticate
  await page.goto('/');
  await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');
  await page.getByLabel(/password/i).fill('testpass123');
  await page.getByRole('button', { name: /log in/i }).click();

  // Create a task
  await page.getByRole('button', { name: /new task/i }).click();
  await page.getByRole('textbox', { name: /title/i }).fill('Buy groceries');
  await page.getByRole('button', { name: /create/i }).click();

  // Verify task appears
  const task = page.getByRole('listitem', { name: /buy groceries/i });
  await expect(task).toBeVisible();

  // Complete the task
  await task.getByRole('checkbox', { name: /complete buy groceries/i }).check();
  await expect(task).toHaveCSS('text-decoration-line', 'line-through');
});
```

## Test Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|---|---|---|
| Testing implementation details | Breaks on refactor | Test inputs/outputs |
| Snapshot everything | No one reviews snapshot diffs | Assert specific values |
| Shared mutable state | Tests pollute each other | Setup/teardown per test |
| Testing third-party code | Wastes time, not your bug | Mock the boundary |
| Skipping tests to pass CI | Hides real bugs | Fix or delete the test |
| Using `test.skip` permanently | Dead code | Remove or fix it |
| Overly broad assertions | Doesn't catch regressions | Be specific |
| No async error handling | Swallowed errors, false passes | Always `await` async tests |
