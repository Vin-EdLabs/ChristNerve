import React from 'react';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'whatsapp' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  whatsapp: 'btn-whatsapp',
  danger: 'btn-danger',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const classes = [
    'btn',
    variantClass[variant],
    sizeClass[size],
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <span className="spinner spinner-sm" aria-hidden />}
      {children}
    </button>
  );
};

export default Button;
