import { describe, expect, it } from 'vitest';
import {
  filterAnchorTextRecs,
  filterInternalLinkingRecs,
  isActionableGenericAnchor,
  isCatalogHubPage,
  isContentPage,
  isEcommerceButtonAnchor,
  isGenericAnchor,
  isHomePage,
  isValidLinkSourcePage,
} from './linkAudit';

const SITE = 'https://www.55detailshop.com.ar';

describe('isHomePage', () => {
  it('detecta la home con y sin barra final', () => {
    expect(isHomePage(`${SITE}/`, SITE)).toBe(true);
    expect(isHomePage(SITE, `${SITE}/`)).toBe(true);
  });

  it('no confunde una pagina interna con la home', () => {
    expect(isHomePage(`${SITE}/blog/detailing`, SITE)).toBe(false);
  });
});

describe('isCatalogHubPage / isContentPage', () => {
  it('marca tienda y hubs de catalogo como origen invalido', () => {
    expect(isCatalogHubPage(`${SITE}/tienda/`, SITE)).toBe(true);
    expect(isCatalogHubPage(`${SITE}/productos/`, SITE)).toBe(true);
    expect(isCatalogHubPage(`${SITE}/categorias/shampoos`, SITE)).toBe(true);
    expect(isCatalogHubPage(SITE, SITE)).toBe(true);
  });

  it('marca blog y articulos como paginas de contenido', () => {
    expect(isContentPage(`${SITE}/blog/que-es-el-detailing`)).toBe(true);
    expect(isContentPage(`${SITE}/categoria-producto/shampoos`)).toBe(false);
  });
});

describe('isValidLinkSourcePage', () => {
  it('rechaza home y catalogo como origen de enlaces contextuales', () => {
    expect(isValidLinkSourcePage(SITE, SITE)).toBe(false);
    expect(isValidLinkSourcePage(`${SITE}/tienda/`, SITE)).toBe(false);
  });

  it('acepta blog como origen valido', () => {
    expect(isValidLinkSourcePage(`${SITE}/blog/guia-cera`, SITE)).toBe(true);
  });
});

describe('isGenericAnchor / isEcommerceButtonAnchor', () => {
  it('detecta anclas genericas comunes', () => {
    expect(isGenericAnchor('click aquí')).toBe(true);
    expect(isGenericAnchor('ver más')).toBe(true);
    expect(isGenericAnchor('foam lance con acople')).toBe(false);
  });

  it('detecta botones de ecommerce', () => {
    expect(isEcommerceButtonAnchor('Añadir al carrito')).toBe(true);
    expect(isEcommerceButtonAnchor('Vista rápida')).toBe(true);
    expect(isEcommerceButtonAnchor('Guía de aplicación')).toBe(false);
  });
});

describe('isActionableGenericAnchor', () => {
  it('no sugiere mejorar botones de grilla WooCommerce', () => {
    expect(
      isActionableGenericAnchor(
        'Vista rápida',
        `${SITE}/categoria-producto/shampoos`,
        SITE,
        'category',
        true
      )
    ).toBe(false);
  });

  it('si sugiere mejorar genericos en paginas de contenido', () => {
    expect(
      isActionableGenericAnchor(
        'ver más',
        `${SITE}/blog/guia-cera`,
        SITE,
        'post',
        false
      )
    ).toBe(true);
  });
});

describe('filterInternalLinkingRecs / filterAnchorTextRecs', () => {
  it('filtra recomendaciones que salen de hubs de catalogo', () => {
    const filtered = filterInternalLinkingRecs(
      [
        { fromPage: `${SITE}/tienda/`, toPage: `${SITE}/producto/x`, suggestedAnchor: 'ver producto' },
        { fromPage: `${SITE}/blog/guia`, toPage: `${SITE}/producto/x`, suggestedAnchor: 'foam lance' },
      ],
      SITE
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].fromPage).toContain('/blog/');
  });

  it('prioriza paginas de contenido sobre otras origenes validos', () => {
    const filtered = filterAnchorTextRecs(
      [
        { page: `${SITE}/contacto`, currentAnchor: 'click aquí', linkTo: `${SITE}/x` },
        { page: `${SITE}/blog/guia`, currentAnchor: 'click aquí', linkTo: `${SITE}/y` },
      ],
      SITE
    );
    expect(filtered[0].page).toContain('/blog/');
  });
});
