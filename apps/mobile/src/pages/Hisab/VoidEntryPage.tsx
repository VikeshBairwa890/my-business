import React from 'react';
import { VoidEntryModal } from '../../components/common/VoidEntryModal';
import { FormSpec, Row } from '../../types';

export interface VoidEntryPageProps {
  spec: FormSpec;
  entry?: Row;
  site?: Row;
  worker?: Row;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
}

/**
 * Dedicated Page for `/ledger/void`
 */
export function VoidEntryPage({
  spec,
  entry,
  site,
  worker,
  busy,
  error,
  onBack,
  onSave,
}: VoidEntryPageProps) {
  return (
    <VoidEntryModal
      spec={spec}
      entry={entry}
      site={site}
      worker={worker}
      busy={busy}
      error={error}
      onClose={onBack}
      onSave={onSave}
    />
  );
}
