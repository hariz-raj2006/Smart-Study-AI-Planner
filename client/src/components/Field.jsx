import { forwardRef, useId } from 'react';

/**
 * Accessible form fields. Each one wires label, hint and error message to the input
 * (htmlFor, aria-describedby, aria-invalid). Forms using them should set noValidate and
 * show their own messages (browser pop-ups are not used).
 */

function useFieldIds() {
  const id = useId();
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

function Wrapper({ id, label, hint, hintId, error, errorId, required, className, children }) {
  return (
    <div className={`field${error ? ' field--error' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
        {required && (
          <span className="field__req" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy({ hint, error, hintId, errorId }) {
  return [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
}

export const TextField = forwardRef(function TextField({ label, hint, error, required, className, ...props }, ref) {
  const { id, hintId, errorId } = useFieldIds();
  return (
    <Wrapper {...{ id, label, hint, hintId, error, errorId, required, className }}>
      <input
        id={id}
        ref={ref}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy({ hint, error, hintId, errorId })}
        {...props}
      />
    </Wrapper>
  );
});

export const SelectField = forwardRef(function SelectField({ label, hint, error, required, className, children, ...props }, ref) {
  const { id, hintId, errorId } = useFieldIds();
  return (
    <Wrapper {...{ id, label, hint, hintId, error, errorId, required, className }}>
      <select
        id={id}
        ref={ref}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy({ hint, error, hintId, errorId })}
        {...props}
      >
        {children}
      </select>
    </Wrapper>
  );
});

export const TextareaField = forwardRef(function TextareaField({ label, hint, error, required, className, ...props }, ref) {
  const { id, hintId, errorId } = useFieldIds();
  return (
    <Wrapper {...{ id, label, hint, hintId, error, errorId, required, className }}>
      <textarea
        id={id}
        ref={ref}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy({ hint, error, hintId, errorId })}
        {...props}
      />
    </Wrapper>
  );
});

export function CheckboxField({ label, hint, className = '', ...props }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label className="check" htmlFor={id}>
        <input id={id} type="checkbox" aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
        <span className="check__text">{label}</span>
      </label>
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A group of related controls (for example the study-day buttons). */
export function FieldGroup({ legend, error, hint, children }) {
  const id = useId();
  return (
    <fieldset className="field-group" aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined}>
      <legend>{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}