'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { getPostHogHost, getPostHogKey, isPostHogEnabled } from '../lib/posthog';

let posthogBootstrapped = false;

function ensurePostHog() {
  if (typeof window === 'undefined') return false;
  if (!isPostHogEnabled()) return false;
  if (posthogBootstrapped || posthog.__loaded) return true;

  try {
    posthog.init(getPostHogKey(), {
      api_host: getPostHogHost(),
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    });
    posthogBootstrapped = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Solo analytics. NO envuelve la UI — así la landing hidrata y los botones
 * funcionan aunque PostHog o useSearchParams tarden.
 */
export default function PostHogProvider() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    ensurePostHog();
  }, []);

  useEffect(() => {
    if (!ensurePostHog()) return;

    if (status === 'authenticated' && session?.user?.email) {
      wasAuthenticated.current = true;
      try {
        posthog.identify(session.user.email, {
          email: session.user.email,
          name: session.user.name || undefined,
        });
      } catch {
        /* ignore */
      }
    } else if (status === 'unauthenticated' && wasAuthenticated.current) {
      wasAuthenticated.current = false;
      try {
        posthog.reset();
      } catch {
        /* ignore */
      }
    }
  }, [status, session?.user?.email, session?.user?.name]);

  useEffect(() => {
    if (!ensurePostHog()) return;
    if (!pathname) return;

    try {
      const qs = searchParams?.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      posthog.capture('$pageview', { $current_url: url });
    } catch {
      /* ignore */
    }
  }, [pathname, searchParams]);

  return null;
}
