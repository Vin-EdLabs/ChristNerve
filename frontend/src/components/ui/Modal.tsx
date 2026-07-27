import React from 'react';
import { SlidePanel } from './SlidePanel';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}

/**
 * Dashboard “modals” are right-side slide panels (no centered popup overlay).
 * Kept as `Modal` so existing call sites keep working.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size,
}) => (
  <SlidePanel
    open={open}
    onClose={onClose}
    title={title}
    subtitle={subtitle}
    footer={footer}
    size={size}
  >
    {children}
  </SlidePanel>
);

export default Modal;
