import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  icon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="form-group">
      {label && (
        <label className="label" htmlFor={inputId}>
          {label}
        </label>
      )}
      {icon ? (
        <div className="input-with-icon">
          <span className="input-icon">{icon}</span>
          <input
            id={inputId}
            className={`input ${error ? 'input-error' : ''} ${className}`.trim()}
            {...props}
          />
        </div>
      ) : (
        <input
          id={inputId}
          className={`input ${error ? 'input-error' : ''} ${className}`.trim()}
          {...props}
        />
      )}
      {error && <p className="form-error">{error}</p>}
      {!error && hint && <p className="form-hint">{hint}</p>}
    </div>
  );
};

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="form-group">
      {label && (
        <label className="label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`textarea ${error ? 'input-error' : ''} ${className}`.trim()}
        {...props}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="form-group">
      {label && (
        <label className="label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`select ${error ? 'input-error' : ''} ${className}`.trim()}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

export default Input;
