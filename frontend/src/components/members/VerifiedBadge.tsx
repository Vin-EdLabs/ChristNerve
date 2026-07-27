import React from 'react';
import { ShieldCheck } from 'lucide-react';

export interface VerifiedBadgeProps {
  label?: string;
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  label = 'Verified',
  className = '',
}) => {
  return (
    <span className={`verified-badge ${className}`.trim()}>
      <ShieldCheck size={12} />
      {label}
    </span>
  );
};

export default VerifiedBadge;
