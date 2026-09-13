import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode | React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const renderIconNode = () => {
    if (!icon) return <Inbox size={24} />;
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && 'render' in (icon as any))
    ) {
      const IconComp = icon as React.ComponentType<{ size?: number; className?: string }>;
      return <IconComp size={24} />;
    }
    return icon as React.ReactNode;
  };

  return (
    <div className="empty-state">
      <div className="empty-state-icon">{renderIconNode()}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-text">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
