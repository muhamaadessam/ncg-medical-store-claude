import { useEffect } from 'react';

const SITE = 'NCG Pharmacy';

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);
}
