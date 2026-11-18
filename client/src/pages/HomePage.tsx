import { useQuery } from '@tanstack/react-query';
import { formatKWD } from '@ncg/shared';
import { apiFetch } from '@/lib/api';

interface Health {
  status: string;
}

export function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/api/health'),
  });

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">NCG Pharmacy</h1>
      <p className="text-muted-foreground">
        Catalog coming soon. Bundle pricing example: {formatKWD(39000)}.
      </p>
      <p className="text-sm">
        API status:{' '}
        {health.isPending ? 'checking…' : health.isError ? 'unreachable' : health.data.status}
      </p>
    </section>
  );
}
