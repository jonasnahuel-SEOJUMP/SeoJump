'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { getPostHogHost, getPostHogKey, isPostHogEnabled } from '../lib/posthog';

let posthogBootstrapped = false;

function ensurePostHog() {
  if (typeof window === 'undefined') return false;
  if (!isPostHogEnabled()) return false;
  if (posthogBootstrapped || posthog.__loaded) return true;

  posthog.init(getPostHogKey(), {
    api_host: getPostHogHost(),
    person_profiles: 'identified_only',
    capture_pageview: false, // lo hacemos manual por App Router
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  });
  posthogBootstrapped = true;
  return true;
}

/**
 * Inicializa PostHog, identifica al usuario logueado y registra pageviews.
 * Si no hay NEXT_PUBLIC_POSTHOG_KEY, no hace nada.
 */
export default function PostHogProvider({ children }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    ensurePostHog();
  }, []);

  // Identificar / resetear según sesión
  useEffect(() => {
    if (!ensurePostHog()) return;

    if (status === 'authenticated' && session?.user?.email) {
      posthog.identify(session.user.email, {
        email: session.user.email,
        name: session.user.name || undefined,
      });
    } else if (status === 'unauthenticated') {
      posthog.reset();
    }
  }, [status, session?.user?.email, session?.user?.name]);

  // Pageviews en App Router
  useEffect(() => {
    if (!ensurePostHog()) return;
    if (!pathname) return;

    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return children;
}
