import { useState } from 'react'
import { validateField } from '../../utils/formValidation'

/**
 * Reusable FormInput component with integrated validation
 * Props:
 *   - field: validation field name (e.g., 'name', 'email')
 *   - value: input value
 *   - onChange: handler function
 *   - required: whether field is required
 *   - label: field label
 *   - placeholder: input placeholder
 *   - type: input type (text, email, tel, etc.)
 *   - error: error message from parent
 *   - icon: lucide icon component (optional)
 *   - disabled: disable input
 *   - maxLength: override max length (optional)
 */
export default function FormInput({
  field,
  value = '',
  onChange,
  required = false,
  label,
  placeholder,
  type = 'text',
  error,
  icon: Icon,
  disabled = false,
  maxLength,
  className = ''
}) {
  const [touched, setTouched] = useState(false)

  const handleChange = (e) => {
    let v = e.target.value
    
    // Apply length restriction
    if (maxLength) {
      v = v.slice(0, maxLength)
    }
    
    // Apply field-specific restrictions
    if (field === 'phone') {
      v = v.replace(/\D/g, '').slice(0, 10)
    } else if (field === 'gst') {
      v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
    } else if (field === 'vehicleNumber') {
      v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)
    }
    
    onChange(v)
  }

  const handleBlur = () => {
    setTouched(true)
  }

  // Validate if touched or error provided
  const validationError = touched && field ? validateField(field, value) : error

  const inputClasses = `
    w-full px-3 py-2.5 text-sm rounded-lg border
    bg-white dark:bg-navy-800/60
    text-slate-800 dark:text-slate-100
    placeholder-slate-300 dark:placeholder-slate-600
    focus:outline-none focus:ring-2 focus:ring-blue-500/25
    focus:border-blue-400 dark:focus:border-blue-500
    transition-all font-body
    ${Icon ? 'pl-9' : ''}
    ${validationError ? 'border-red-400 dark:border-red-600 focus:ring-red-500/25' : 'border-slate-200 dark:border-navy-700'}
    ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
    ${className}
  `

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
            <Icon size={14} />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          className={inputClasses}
        />
      </div>
      {validationError && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">
          {validationError}
        </p>
      )}
    </div>
  )
}