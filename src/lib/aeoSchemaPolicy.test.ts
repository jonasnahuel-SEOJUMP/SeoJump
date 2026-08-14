import { describe, expect, it } from 'vitest';
import {
  shouldAutoOfferFaqSchema,
  shouldAutoOfferProductSchema,
  aeoEndsAtVisibleContent,
  refinePageTypeWithSchema,
  aeoNextStepCopy,
} from './aeoSchemaPolicy';

describe('aeoSchemaPolicy', () => {
  it('no ofrece FAQ Schema automático en categoría / producto / home / post', () => {
    expect(shouldAutoOfferFaqSchema('category')).toBe(false);
    expect(shouldAutoOfferFaqSchema('product')).toBe(false);
    expect(shouldAutoOfferFaqSchema('home')).toBe(false);
    expect(shouldAutoOfferFaqSchema('post')).toBe(false);
    expect(shouldAutoOfferFaqSchema('unknown')).toBe(false);
  });

  it('sí puede ofrecer FAQ Schema en página genérica', () => {
    expect(shouldAutoOfferFaqSchema('page')).toBe(true);
  });

  it('Product Schema solo en producto', () => {
    expect(shouldAutoOfferProductSchema('product')).toBe(true);
    expect(shouldAutoOfferProductSchema('category')).toBe(false);
  });

  it('categoría termina en contenido visible', () => {
    expect(aeoEndsAtVisibleContent('category')).toBe(true);
    expect(aeoEndsAtVisibleContent('product')).toBe(false);
  });

  it('CollectionPage refina a categoría', () => {
    expect(refinePageTypeWithSchema('unknown', ['CollectionPage'])).toBe('category');
    expect(refinePageTypeWithSchema('product', ['Product'])).toBe('product');
  });

  it('copy de categoría no empuja FAQ Schema', () => {
    const c = aeoNextStepCopy('category');
    expect(c.contentFirst).toMatch(/categoría/i);
    expect(c.schemaLater).toMatch(/no hace falta FAQPage/i);
  });
});
