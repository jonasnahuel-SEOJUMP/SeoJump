import { NextResponse } from 'next/server';
import { getAIPredictiveSuggestions } from '../../../lib/actions';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const siteUrl = searchParams.get('siteUrl') || '';
    const excludedWords = searchParams.get('excludedWords') || '';

    if (!q) {
      return NextResponse.json({ error: 'Falta la palabra clave (q)' }, { status: 400 });
    }

    const result = await getAIPredictiveSuggestions(siteUrl, q, excludedWords);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Error al buscar oportunidades con IA.' }, { status: 500 });
    }

    return NextResponse.json({
      suggestions: result.suggestions,
      nicho: result.nicho,
    });
  } catch (error) {
    console.error('Error in suggestions route handler:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
