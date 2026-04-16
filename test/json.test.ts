import { describe, it, expect, vi } from 'vitest'
import { JSONPathWalker } from '../src/json'
import { Handler, WalkerFactory } from '../src/walker'

describe('JSONPathWalker — loadAll', () => {
  it('resolves multiple paths at once, returning matches in order', () => {
    const walker = new JSONPathWalker(false)
    const results = walker.loadAll(['@.apple', '@.carrot.count', '@.mango.color'], {
      apple: { color: 'red' },
      carrot: { color: 'orange' },
      mango: { color: 'orange' },
    })
    expect(results[0]).toEqual({ color: 'red' })
    expect(results[1]).toBeUndefined()
    expect(results[2]).toBe('orange')
  })

  it('loadAll returns undefined for paths that do not exist', () => {
    const walker = new JSONPathWalker(false)
    const results = walker.loadAll(['@.missing.key'], { present: 1 })
    expect(results[0]).toBeUndefined()
  })

  it('loadAll handles deeply nested paths', () => {
    const walker = new JSONPathWalker(false)
    const results = walker.loadAll(['@.a.b.c.d'], { a: { b: { c: { d: 42 } } } })
    expect(results[0]).toBe(42)
  })

  it('loadAll reads from arrays by index', () => {
    const walker = new JSONPathWalker(false)
    const results = walker.loadAll(['@.items.0', '@.items.2'], {
      items: ['first', 'second', 'third'],
    })
    expect(results[0]).toBe('first')
    expect(results[1]).toBe('third')
  })
})

describe('JSONPathWalker — walk + handlers', () => {
  it('delivers items to handlers registered via addHandler', () => {
    const walker = new JSONPathWalker(false)
    const success = vi.fn()
    walker.addHandler('@.name', new Handler(success, () => {}))
    walker.walk({ name: 'Andrew', age: 41 })
    expect(success).toHaveBeenCalledWith('Andrew')
  })

  it('delivers to multiple handlers on different paths', () => {
    const walker = new JSONPathWalker(false)
    const nameFn = vi.fn()
    const ageFn = vi.fn()
    walker.addHandler('@.name', new Handler(nameFn, () => {}))
    walker.addHandler('@.age', new Handler(ageFn, () => {}))
    walker.walk({ name: 'A', age: 42 })
    expect(nameFn).toHaveBeenCalledWith('A')
    expect(ageFn).toHaveBeenCalledWith(42)
  })

  it('delivers multiple handlers on the SAME path', () => {
    const walker = new JSONPathWalker(false)
    const first = vi.fn()
    const second = vi.fn()
    walker.addHandler('@.x', new Handler(first, () => {}))
    walker.addHandler('@.x', new Handler(second, () => {}))
    walker.walk({ x: 'hello' })
    expect(first).toHaveBeenCalledWith('hello')
    expect(second).toHaveBeenCalledWith('hello')
  })

  it('walks into nested objects', () => {
    const walker = new JSONPathWalker(false)
    const deep = vi.fn()
    walker.addHandler('@.user.profile.name', new Handler(deep, () => {}))
    walker.walk({ user: { profile: { name: 'deep' } } })
    expect(deep).toHaveBeenCalledWith('deep')
  })

  it('walks into arrays by numeric index', () => {
    const walker = new JSONPathWalker(false)
    const item = vi.fn()
    walker.addHandler('@.tags.1', new Handler(item, () => {}))
    walker.walk({ tags: ['a', 'b', 'c'] })
    expect(item).toHaveBeenCalledWith('b')
  })

  it('calls error handlers for unfound paths when errorOnUnfound=true', () => {
    const walker = new JSONPathWalker(true)
    const success = vi.fn()
    const error = vi.fn()
    walker.addHandler('@.missing', new Handler(success, error))
    walker.walk({ other: 1 })
    expect(success).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalled()
  })

  it('silently ignores unfound paths when errorOnUnfound=false', () => {
    const walker = new JSONPathWalker(false)
    const success = vi.fn()
    const error = vi.fn()
    walker.addHandler('@.missing', new Handler(success, error))
    walker.walk({ other: 1 })
    expect(success).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('does not traverse into keys it was not asked about', () => {
    const walker = new JSONPathWalker(false)
    const watcher = vi.fn()
    walker.addHandler('@.a', new Handler(watcher, () => {}))
    walker.walk({ a: 1, b: 2, c: 3 })
    expect(watcher).toHaveBeenCalledTimes(1)
  })
})

describe('WalkerFactory', () => {
  it('creates a JSONPathWalker for type "json"', () => {
    const walker = WalkerFactory.create('json')
    expect(walker).toBeInstanceOf(JSONPathWalker)
  })

  it('throws for unknown walker types', () => {
    expect(() => WalkerFactory.create('xml' as any)).toThrow(/No known walker for type/)
  })
})

describe('Handler', () => {
  it('stores success, error, and optional complete callbacks', () => {
    const success = vi.fn()
    const error = vi.fn()
    const complete = vi.fn()
    const h = new Handler(success, error, complete)
    expect(h.success).toBe(success)
    expect(h.error).toBe(error)
    expect(h.complete).toBe(complete)
  })
})
