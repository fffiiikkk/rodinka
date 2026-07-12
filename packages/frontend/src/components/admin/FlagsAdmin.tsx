import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export default function FlagsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['flags'],
    queryFn: () => api.get<{ flags: Array<{ id: string; key: string; enabled: boolean }> }>('/flags').then((r) => r.flags),
  });

  const toggle = async (key: string, current: boolean) => {
    await api.patch(`/flags/${key}`, { enabled: !current });
    qc.invalidateQueries({ queryKey: ['flags'] });
  };

  return (
    <div className="space-y-2">
      {data?.map((flag) => (
        <div key={flag.key} className="card p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm text-ink">{flag.key}</p>
          </div>
          <button
            onClick={() => toggle(flag.key, flag.enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${flag.enabled ? 'bg-success' : 'bg-border'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${flag.enabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      ))}
    </div>
  );
}
