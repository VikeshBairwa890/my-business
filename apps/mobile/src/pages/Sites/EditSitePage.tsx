import React from 'react';
import { SiteFormModal } from '../../components/sites/SiteFormModal';
import { FormSpec } from '../../types';

export interface EditSitePageProps {
  spec: FormSpec;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
}

/**
 * Dedicated Page for `/sites/:id/edit`
 */
export function EditSitePage({
  spec,
  busy,
  error,
  onBack,
  onSave,
}: EditSitePageProps) {
  return (
    <SiteFormModal
      spec={spec}
      busy={busy}
      error={error}
      onClose={onBack}
      onSave={onSave}
      asPage
    />
  );
}
