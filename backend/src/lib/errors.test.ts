import { describe, it, expect } from 'vitest';
import { NotFoundError, ConflictError, ValidationError, AppError } from './errors';

describe('NotFoundError message', () => {
  // The live API returned "Invoice not found not found" for a missing invoice,
  // because 78 call sites pass a message that already ends in "not found" to a
  // constructor that appended it again.
  it('does not repeat "not found" when the caller already said it', () => {
    expect(new NotFoundError('Invoice not found').message).toBe('Invoice not found');
    expect(new NotFoundError('Case not found').message).toBe('Case not found');
    expect(new NotFoundError('Document not found on this case').message)
      .toBe('Document not found on this case');
  });

  it('still appends it for callers that pass a bare resource name', () => {
    expect(new NotFoundError('Invoice').message).toBe('Invoice not found');
    expect(new NotFoundError().message).toBe('Resource not found');
  });

  it('is case insensitive and tolerates a trailing period or space', () => {
    expect(new NotFoundError('Invoice NOT FOUND').message).toBe('Invoice NOT FOUND');
    expect(new NotFoundError('Invoice not found.').message).toBe('Invoice not found.');
    expect(new NotFoundError('Invoice not found ').message).toBe('Invoice not found ');
  });

  it('leaves a whole sentence alone wherever the phrase sits in it', () => {
    // Matched anywhere rather than at the end, because several call sites pass
    // a full sentence. The trade is that a resource whose NAME contains the
    // phrase would not get a suffix — no such call site exists, and a missing
    // suffix reads far better than a doubled one.
    expect(new NotFoundError('Not found template').message).toBe('Not found template');
  });

  it('is still a 404', () => {
    expect(new NotFoundError('Invoice not found').statusCode).toBe(404);
  });
});

describe('error status codes', () => {
  it.each([
    [new ConflictError('x'), 409],
    [new ValidationError('x'), 400],
    [new AppError('x', 503), 503],
  ])('%s carries its status', (err, status) => {
    expect((err as AppError).statusCode).toBe(status);
  });
});
