/**
 * AURAFIN · Primitivas UI del sistema de diseño "Aurora Fintech".
 * Componentes pequeños, reutilizables y tokenizados (ver src/index.css).
 * La lógica de negocio vive fuera de estos componentes.
 */
import React, { useEffect, useId } from 'react';
import { X, Inbox, Loader2 } from 'lucide-react';

/* ------------------------------------------------------------ */
/* Botones                                                       */
/* ------------------------------------------------------------ */
type ButtonVariant = 'primary' | 'solid' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}) => (
  <button
    className={`btn btn-${variant} ${size !== 'md' ? `btn-${size}` : ''} ${className}`}
    disabled={disabled || loading}
    {...rest}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : icon}
    {children}
  </button>
);

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({ label, active = false, className = '', children, ...rest }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`btn btn-ghost btn-icon ${active ? '!bg-[var(--accent-soft)] !text-[var(--accent)]' : ''} ${className}`}
    {...rest}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------ */
/* Tarjetas y contenedores                                       */
/* ------------------------------------------------------------ */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { hover?: boolean; padded?: boolean }> = ({
  hover = false,
  padded = true,
  className = '',
  children,
  ...rest
}) => (
  <div className={`card ${hover ? 'card-hover' : ''} ${padded ? 'p-5 sm:p-6' : ''} ${className}`} {...rest}>
    {children}
  </div>
);

export const SectionHeader: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}> = ({ eyebrow, title, subtitle, actions, className = '' }) => (
  <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
    <div className="min-w-0">
      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
      <h2 className="section-title">{title}</h2>
      {subtitle && <p className="section-sub mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/* ------------------------------------------------------------ */
/* Badges y chips                                                */
/* ------------------------------------------------------------ */
type BadgeTone = 'neutral' | 'accent' | 'income' | 'expense' | 'goal' | 'info' | 'ai';

export const Badge: React.FC<{ tone?: BadgeTone; className?: string; children: React.ReactNode }> = ({
  tone = 'neutral',
  className = '',
  children,
}) => <span className={`badge ${tone !== 'neutral' ? `badge-${tone}` : ''} ${className}`}>{children}</span>;

export const Chip: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }> = ({
  active = false,
  className = '',
  children,
  ...rest
}) => (
  <button type="button" className={`chip ${active ? 'chip-active' : ''} ${className}`} aria-pressed={active} {...rest}>
    {children}
  </button>
);

/* ------------------------------------------------------------ */
/* Formularios                                                   */
/* ------------------------------------------------------------ */
export const Field: React.FC<{
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, hint, error, htmlFor, children, className = '' }) => {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  // Asocia el label con el control hijo (Input/Select/Textarea) automáticamente.
  const child =
    React.Children.count(children) === 1 && React.isValidElement(children)
      ? React.cloneElement(children as React.ReactElement<{ id?: string }>, {
          id: (children as React.ReactElement<{ id?: string }>).props.id ?? id,
        })
      : children;
  return (
    <div className={`field ${className}`}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {child}
      {error ? <span className="error-text">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
};

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', id, ...rest }, ref) => {
    const autoId = useId();
    return <input ref={ref} id={id ?? autoId} className={`input ${className}`} {...rest} />;
  }
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', id, children, ...rest }, ref) => {
    const autoId = useId();
    return (
      <select ref={ref} id={id ?? autoId} className={`select ${className}`} {...rest}>
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', id, ...rest }, ref) => {
    const autoId = useId();
    return <textarea ref={ref} id={id ?? autoId} className={`textarea ${className}`} {...rest} />;
  }
);
Textarea.displayName = 'Textarea';

/* ------------------------------------------------------------ */
/* Stats                                                         */
/* ------------------------------------------------------------ */
export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'accent' | 'income' | 'expense' | 'goal' | 'info' | 'ai';
  footer?: React.ReactNode;
  className?: string;
}> = ({ label, value, icon, tone = 'accent', footer, className = '' }) => (
  <div className={`card p-4 sm:p-5 ${className}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="stat-label">{label}</span>
      {icon && (
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `var(--${tone}-soft, var(--accent-soft))`, color: `var(--${tone}, var(--accent))` }}
        >
          {icon}
        </span>
      )}
    </div>
    <div className="stat-value mt-2 num">{value}</div>
    {footer && <div className="mt-1.5 text-xs text-muted">{footer}</div>}
  </div>
);

export const ProgressBar: React.FC<{ value: number; className?: string; label?: string }> = ({
  value,
  className = '',
  label,
}) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`progress ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
};

/* ------------------------------------------------------------ */
/* Estados: vacío, carga, error                                  */
/* ------------------------------------------------------------ */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className = '' }) => (
  <div className={`card p-8 sm:p-10 flex flex-col items-center text-center gap-3 ${className}`}>
    <div className="w-12 h-12 rounded-2xl inset flex items-center justify-center text-muted">
      {icon ?? <Inbox className="w-6 h-6" aria-hidden />}
    </div>
    <h3 className="section-title">{title}</h3>
    {description && <p className="text-sm text-muted max-w-sm">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const Spinner: React.FC<{ label?: string; className?: string }> = ({ label = 'Cargando…', className = '' }) => (
  <div className={`flex items-center justify-center gap-2 text-muted text-sm py-8 ${className}`} role="status">
    <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
    <span>{label}</span>
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton ${className}`} aria-hidden />
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void; className?: string }> = ({
  message,
  onRetry,
  className = '',
}) => (
  <div className={`card p-5 border-[color-mix(in_srgb,var(--expense)_35%,transparent)] ${className}`} role="alert">
    <p className="text-sm font-semibold text-expense">{message}</p>
    {onRetry && (
      <Button variant="danger" size="sm" className="mt-3" onClick={onRetry}>
        Reintentar
      </Button>
    )}
  </div>
);

/* ------------------------------------------------------------ */
/* Modal accesible (bottom-sheet en móvil vía CSS)               */
/* ------------------------------------------------------------ */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'max-w-lg',
  footer,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-panel ${maxWidth}`} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <span className="w-9 h-9 rounded-xl bg-gradient-aura text-white flex items-center justify-center shrink-0">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="section-title truncate">{title}</h2>
              {subtitle && <p className="section-sub truncate">{subtitle}</p>}
            </div>
          </div>
          <IconButton label="Cerrar" onClick={onClose}>
            <X className="w-4 h-4" />
          </IconButton>
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};