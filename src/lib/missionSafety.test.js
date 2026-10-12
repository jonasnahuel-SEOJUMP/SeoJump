import { describe, it, expect } from 'vitest';
import {
  SLUG_WARNING,
  SLUG_WARNING_CATEGORY_CHILDREN,
  getSlugWarnings,
  missionTextInstructsUnsafeUrlEdit,
  shouldDiscardAiMissionCopy,
  validateMissionTexts,
} from './missionSafety';
import {
  getEditWhereGuide,
  getPlainMissionLabels,
} from './cmsGuide';

const PULIDORAS_URL =
  'https://www.55detailshop.com.ar/estetica-vehicular/maquinas-para-detailing-hidrolavadoras-aspiradoras-pulidoras-lijadoras-y-taladros/pulidoras/';

function guideBlob(guide) {
  return [
    guide.fieldLabel,
    ...(guide.steps || []),
    ...(guide.commonMistakes || []),
    ...(guide.slugWarnings || []),
  ].join('\n');
}

/** Acción insegura: manda a editar Nombre / Slug como tarea (no como advertencia). */
function instructsNombreOrSlugAsAction(text) {
  const t = String(text || '');
  // "ajustá/cambiá el Nombre" sin "no toques"
  if (
    /\b(ajust[áa]|cambi[áa]|modific[áa]|edit[áa]|borr[áa]).{0,40}\bnombre\b/i.test(t) &&
    !/\bno\s+toques\b|\bno\s+edites\b|\bno\s+cambies\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\b(cambi[áa]|modific[áa]|edit[áa]|actualiz[áa]).{0,40}\b(slug|permalink|enlace\s+permanente)\b/i.test(
      t
    ) &&
    !/\bno\s+toques\b|\bno\s+cambies\b|\bno\s+edites\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

describe('missionSafety — validador post-generación', () => {
  it('descarta textos que piden modificar slug, URL o permalink', () => {
    expect(missionTextInstructsUnsafeUrlEdit('Cambiá el slug de la categoría')).toBe(true);
    expect(missionTextInstructsUnsafeUrlEdit('Editá el enlace permanente')).toBe(true);
    expect(missionTextInstructsUnsafeUrlEdit('Actualizá la URL del producto')).toBe(true);
    expect(missionTextInstructsUnsafeUrlEdit('Modificá el permalink')).toBe(true);
  });

  it('descarta textos que piden editar el Nombre de producto/categoría', () => {
    expect(
      missionTextInstructsUnsafeUrlEdit(
        'Arriba podés ajustar el Nombre de la categoría (título visible en la página).'
      )
    ).toBe(true);
    expect(
      missionTextInstructsUnsafeUrlEdit(
        'El campo a cambiar es el Nombre del producto: la caja de texto arriba de todo.'
      )
    ).toBe(true);
  });

  it('permite advertencias «No toques el slug»', () => {
    expect(missionTextInstructsUnsafeUrlEdit(SLUG_WARNING)).toBe(false);
    expect(
      missionTextInstructsUnsafeUrlEdit(
        '⚠️ No toques el campo Nombre de la categoría. Editá solo el Título SEO.'
      )
    ).toBe(false);
  });

  it('shouldDiscardAiMissionCopy usa reason y suggestedTitle', () => {
    expect(
      shouldDiscardAiMissionCopy({
        suggestedTitle: 'Pulidora para autos | 55 Detail Shop',
        reason: 'Cambiá el slug para incluir la keyword',
      })
    ).toBe(true);
    expect(
      shouldDiscardAiMissionCopy({
        suggestedTitle: 'Pulidora para autos | 55 Detail Shop',
        reason: 'Incluimos la keyword en el Título SEO.',
      })
    ).toBe(false);
  });

  it('validateMissionTexts reporta hits', () => {
    const r = validateMissionTexts([
      'Pegá el Título SEO',
      'Cambiá el permalink de la página',
    ]);
    expect(r.ok).toBe(false);
    expect(r.hits.length).toBe(1);
  });
});

describe('getSlugWarnings', () => {
  it('incluye warning fijo y extra en categorías', () => {
    const w = getSlugWarnings('category');
    expect(w[0]).toBe(SLUG_WARNING);
    expect(w).toContain(SLUG_WARNING_CATEGORY_CHILDREN);
  });

  it('en productos/páginas solo el warning fijo', () => {
    expect(getSlugWarnings('product')).toEqual([SLUG_WARNING]);
    expect(getSlugWarnings('page')).toEqual([SLUG_WARNING]);
  });
});

describe('cmsGuide — misiones título solo Título SEO', () => {
  const pageTypes = ['product', 'category', 'post', 'page', 'home'];

  for (const pageType of pageTypes) {
    it(`H1 en ${pageType}: fieldLabel es Título SEO y no manda a editar Nombre/Slug`, () => {
      const url =
        pageType === 'home'
          ? 'https://www.55detailshop.com.ar/'
          : pageType === 'product'
            ? 'https://www.55detailshop.com.ar/producto/oxido-de-cerio/'
            : pageType === 'post'
              ? 'https://www.55detailshop.com.ar/blog/guia/'
              : pageType === 'category'
                ? PULIDORAS_URL
                : 'https://www.55detailshop.com.ar/contacto/';

      const guide = getEditWhereGuide(url, 'H1', 'wp_woo', pageType);
      expect(guide.fieldLabel.toLowerCase()).toMatch(/título seo/);
      expect(guide.adminHint).toBeTruthy();
      expect(guide.slugWarnings?.length).toBeGreaterThan(0);
      expect(guide.slugWarnings[0]).toBe(SLUG_WARNING);

      const blob = guideBlob(guide);
      expect(instructsNombreOrSlugAsAction(blob)).toBe(false);
      // Debe mencionar Rank Math o Yoast
      expect(blob.toLowerCase()).toMatch(/rank math|yoast/);
      // Debe advertir sobre slug
      expect(blob.toLowerCase()).toMatch(/slug/);
    });
  }

  it('labels H1 hablan de Título SEO (voseo)', () => {
    const cat = getPlainMissionLabels('H1', 'category');
    expect(cat.action).toMatch(/^Cambiá el Título SEO/);
    expect(cat.shortTitle.toLowerCase()).toMatch(/título seo/);
    const prod = getPlainMissionLabels('H1', 'product');
    expect(prod.action).toMatch(/^Cambiá el Título SEO/);
  });
});

describe('regresión incidente Pulidoras', () => {
  it('categoría Woo + keyword pulidora para autos → Productos→Categorías, sin Nombre/Slug como acción, con warning', () => {
    const guide = getEditWhereGuide(PULIDORAS_URL, 'H1', 'wp_woo', 'category');
    const labels = getPlainMissionLabels('H1', 'category');

    expect(guide.adminHint).toMatch(/Productos → Categorías/);
    expect(guide.pageTypeLabel.toLowerCase()).toMatch(/categor/);
    expect(guide.fieldLabel.toLowerCase()).toMatch(/título seo/);
    expect(labels.action).toBe('Cambiá el Título SEO de esta categoría');

    const blob = guideBlob(guide);
    expect(instructsNombreOrSlugAsAction(blob)).toBe(false);
    // Nunca debe sugerir Páginas como ruta
    expect(blob).not.toMatch(/Páginas → \*\*Todas las páginas\*\*/);
    expect(guide.steps.join(' ')).not.toMatch(/WordPress → \*\*Páginas\*\*/);

    expect(guide.slugWarnings).toContain(SLUG_WARNING);
    expect(guide.slugWarnings).toContain(SLUG_WARNING_CATEGORY_CHILDREN);

    // La keyword del incidente no debe empujar a tocar Nombre
    const withKwHint = `${labels.action} incluyendo «pulidora para autos».\n${blob}`;
    expect(instructsNombreOrSlugAsAction(withKwHint)).toBe(false);
  });
});
