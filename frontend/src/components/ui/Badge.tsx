import React from 'react';

type BadgeVariant =
  | 'active'
  | 'inactive'
  | 'visitor'
  | 'transferred'
  | 'accent'
  | 'gold'
  | 'error'
  | 'default';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant | string;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  active: 'badge-active',
  inactive: 'badge-inactive',
  visitor: 'badge-visitor',
  transferred: 'badge-transferred',
  accent: 'badge-accent',
  gold: 'badge-gold',
  error: 'badge-error',
  default: 'badge-inactive',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
}) => {
  const resolved: BadgeVariant =
    variant in variantClass
      ? (variant as BadgeVariant)
      : statusToBadgeVariant(variant);

  return (
    <span className={`badge ${variantClass[resolved]} ${className}`.trim()}>{children}</span>
  );
};

export const statusToBadgeVariant = (
  status?: string
): BadgeVariant => {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'active';
    case 'visitor':
      return 'visitor';
    case 'transferred':
      return 'transferred';
    case 'inactive':
    default:
      return 'inactive';
  }
};

export default Badge;
