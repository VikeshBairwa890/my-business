import React from 'react';
import { AttendanceModal } from '../../components/attendance/AttendanceModal';
import { FormSpec, Snapshot } from '../../types';

export interface MarkAttendancePageProps {
  spec: FormSpec;
  data: Snapshot;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
}

/**
 * Dedicated Page for `/attendance/mark`
 */
export function MarkAttendancePage({
  spec,
  data,
  busy,
  error,
  onBack,
  onSave,
}: MarkAttendancePageProps) {
  return (
    <AttendanceModal
      spec={spec}
      data={data}
      busy={busy}
      error={error}
      onClose={onBack}
      onSave={onSave}
    />
  );
}
