import { NextResponse } from 'next/server';
import { getAIPredictiveSuggestions } from '../../../lib/actions';

export const maxDuration = 30; // 30 seconds max execution time on Vercel
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

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
      console.error("[ROUTE SUGGESTIONS ERROR] getAIPredictiveSuggestions failed:", result.error);
      return NextResponse.json({ 
        error: true,
        message: result.error || 'Error al buscar oportunidades con IA.',
        stack: result.stack 
      }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    }

    return NextResponse.json({
      suggestions: result.suggestions,
      nicho: result.nicho,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('[ROUTE SUGGESTIONS EXCEPTION] Error in suggestions route handler:', error);
    return NextResponse.json({ 
      error: true,
      message: error.message || 'Error interno del servidor.',
      stack: error.stack
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  }
}
