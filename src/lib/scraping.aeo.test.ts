import { describe, expect, it } from 'vitest';
import {
  isUiNavigationHeading,
  isUiNoiseText,
  normalizeForAeo,
} from './scraping';

describe('normalizeForAeo', () => {
  it('normaliza mayusculas y tildes', () => {
    expect(normalizeForAeo('ÚLTIMOS INGRESOS')).toBe('ultimos ingresos');
    expect(normalizeForAeo('  Vista   Rápida  ')).toBe('vista rapida');
  });
});

describe('isUiNavigationHeading', () => {
  it('marca carruseles de tienda como navegacion/UI', () => {
    expect(isUiNavigationHeading('ÚLTIMOS INGRESOS')).toBe(true);
    expect(isUiNavigationHeading('Productos destacados')).toBe(true);
    expect(isUiNavigationHeading('Más vendidos')).toBe(true);
    expect(isUiNavigationHeading('Ofertas destacadas')).toBe(true);
    expect(isUiNavigationHeading('Nuestras categorías')).toBe(true);
  });

  it('no filtra preguntas informativas reales de blog', () => {
    expect(isUiNavigationHeading('¿Qué es el Detailing o la Estética Vehicular?')).toBe(false);
    expect(isUiNavigationHeading('Beneficios del sellado cerámico')).toBe(false);
    expect(isUiNavigationHeading('Cómo aplicar cera en el auto')).toBe(false);
  });
});

describe('isUiNoiseText', () => {
  it('detecta botones de WooCommerce como ruido de interfaz', () => {
    expect(isUiNoiseText('Añadir a la lista de deseos Vista Rápida Cerámicos')).toBe(true);
    expect(isUiNoiseText('Agregar al carrito')).toBe(true);
    expect(isUiNoiseText('Comprar ahora')).toBe(true);
  });

  it('no marca parrafos informativos como ruido', () => {
    const paragraph =
      'El sellado cerámico es un recubrimiento líquido que protege la laca del vehículo contra rayos UV y químicos.';
    expect(isUiNoiseText(paragraph)).toBe(false);
  });
});
