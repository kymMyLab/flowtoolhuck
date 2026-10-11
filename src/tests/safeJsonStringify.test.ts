import { describe, it, expect } from 'vitest';
import { safeJsonStringify } from '../services/exportService';

describe('safeJsonStringify', () => {
  it('should stringify primitive values', () => {
    expect(safeJsonStringify(1)).toBe('1');
    expect(safeJsonStringify('test')).toBe('"test"');
    expect(safeJsonStringify(true)).toBe('true');
  });

  it('should stringify standard objects', () => {
    expect(safeJsonStringify({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('should exclude React Fiber nodes', () => {
    const obj = {
      a: 1,
      __reactFiber: { $$typeof: Symbol('react.element') }
    };
    const expected = JSON.stringify({ a: 1 }, null, 2);
    expect(safeJsonStringify(obj)).toBe('{\n  "a": 1\n}');
  });

  it('should handle DOM nodes by excluding them', () => {
    const div = document.createElement('div');
    const obj = {
      a: 1,
      dom: div
    };
    expect(safeJsonStringify(obj)).toBe('{\n  "a": 1\n}');
  });

  it('should handle circular references', () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    // Expected output includes circular tag
    expect(safeJsonStringify(obj)).toContain('"[Circular]"');
  });
});
