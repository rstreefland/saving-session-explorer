import { Clock3 } from 'lucide-react';
import { Tooltip } from './Tooltip';

export function ProvisionalIndicator() {
  return (
    <Tooltip
      label="Provisional reading"
      icon={<Clock3 size={14} aria-hidden="true" />}
      text="This estimate uses figures from your Octopus Home Mini device because your smart meter readings have not arrived yet. These are indicative only and may differ to the smart meter readings."
    />
  );
}
