import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Check,
  Search,
  ChevronDown,
} from 'lucide-react';

export const Card = ({
  children,
  className,
  noPadding = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={cn(
      'bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden transition-all duration-200 hover:border-gray-200',
      !noPadding && 'p-4',
      onClick && 'cursor-pointer hover:-translate-y-0.5',
      className
    )}
  >
    {children}
  </div>
);

export const Badge = ({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?:
    | 'default'
    | 'indigo'
    | 'emerald'
    | 'amber'
    | 'red'
    | 'slate'
    | 'teal'
    | 'crimson';
  className?: string;
}) => {
  const variants = {
    default: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
    indigo: 'bg-indigo-500/20 text-indigo-600 border-indigo-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
    amber: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
    red: 'bg-red-500/20 text-red-700 border-red-500/30',
    slate: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
    teal: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
    crimson: 'bg-red-500/20 text-red-700 border-red-500/30',
  };
  return (
    <span
      className={cn(
        'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center justify-center',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

export const Tooltip = ({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <div className="group relative inline-block">
      {children}
      <div className="absolute z-50 invisible group-hover:visible bg-gray-50 text-gray-700 text-[11px] rounded-lg p-3 shadow-xl -bottom-2 translate-y-full left-1/2 -translate-x-1/2 min-w-[240px] border border-gray-200 backdrop-blur-md transition-all duration-200">
        {content}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-white" />
      </div>
    </div>
  );
};

export const KPICard = ({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
  trend,
  onClick,
  className,
  variant = 'primary',
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
}) => (
  <Card
    onClick={onClick}
    className={cn(
      'flex items-center gap-3 border-l-4 border-l-indigo-500 shadow-xl hover:shadow-2xl transition-all duration-200 group h-full',
      onClick && 'cursor-pointer hover:-translate-y-1',
      variant === 'primary' ? 'p-3.5' : 'p-3',
      className
    )}
  >
    <div
      className={cn(
        'rounded-lg flex items-center justify-center text-gray-900 shrink-0 transition-transform duration-200 group-hover:scale-105',
        color,
        variant === 'primary' ? 'w-10 h-10' : 'w-9 h-9'
      )}
    >
      <Icon
        className={cn(
          variant === 'primary' ? 'w-5 h-5' : 'w-4.5 h-4.5'
        )}
      />
    </div>
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          'font-bold text-gray-500 uppercase tracking-widest mb-0.5 font-sans truncate',
          variant === 'primary' ? 'text-[9px]' : 'text-[8px]'
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'font-bold text-gray-900 truncate font-sans tabular-nums tracking-tight leading-none mb-1',
          variant === 'primary' ? 'text-xl' : 'text-lg'
        )}
      >
        {value}
      </p>
      <div className="flex items-center gap-2 overflow-hidden">
        {trend && (
          <span
            className={cn(
              'text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0',
              trend.positive
                ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-700 border border-red-500/30'
            )}
          >
            {trend.value}
          </span>
        )}
        {subtitle && (
          <p className="text-[9px] text-gray-500 font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  </Card>
);

export const Combobox = ({
  options,
  selected,
  onChange,
  placeholder,
  label,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  label: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(
    (opt) =>
      opt.toLowerCase().includes(query.toLowerCase()) &&
      !selected.includes(opt)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
    setQuery('');
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
        {label}
      </label>
      <div className="relative">
        <div
          className={cn(
            'min-h-[38px] w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex flex-wrap gap-1.5 items-center transition-all duration-200',
            isOpen &&
              'ring-2 ring-indigo-500/10 bg-white border-indigo-500'
          )}
        >
          <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <input
            type="text"
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-0 min-w-[100px] placeholder:text-gray-500"
            placeholder={
              selected.length === 0 ? placeholder : ''
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
          />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-500 hover:text-slate-600"
          >
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </button>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto"
            >
              {filteredOptions.length === 0 ? (
                <div className="p-3 text-xs text-gray-500 text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between group"
                  >
                    <span>{opt}</span>
                    <Check className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100" />
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-1 mt-1.5">
        {selected.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded border border-indigo-100 uppercase tracking-wider"
          >
            {item}
            <button
              onClick={() => toggleOption(item)}
              className="hover:text-indigo-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

export const RangeSlider = ({
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}) => {
  const handleLowerChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newVal = Math.min(
      Number(e.target.value),
      value[1] - step
    );
    onChange([newVal, value[1]]);
  };

  const handleUpperChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newVal = Math.max(
      Number(e.target.value),
      value[0] + step
    );
    onChange([value[0], newVal]);
  };

  const lowerPercent = ((value[0] - min) / (max - min)) * 100;
  const upperPercent = ((value[1] - min) / (max - min)) * 100;

  return (
    <div className="relative w-full h-6 flex items-center">
      <div className="absolute w-full h-1.5 bg-slate-200 rounded-lg" />
      <div
        className="absolute h-1.5 bg-indigo-500 rounded-lg"
        style={{
          left: `${lowerPercent}%`,
          width: `${upperPercent - lowerPercent}%`,
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={handleLowerChange}
        className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-indigo-600 [&::-moz-range-thumb]:cursor-pointer"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[1]}
        onChange={handleUpperChange}
        className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-indigo-600 [&::-moz-range-thumb]:cursor-pointer"
      />
    </div>
  );
};

export const Toast = ({
  message,
  isVisible,
  onClose,
}: {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: 50 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20, x: 20 }}
          className="fixed bottom-6 right-6 z-[9999] bg-slate-900 text-gray-900 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-md"
        >
          <div className="w-6 h-6 rounded-full bg-aero-teal flex items-center justify-center">
            <Check className="w-4 h-4 text-gray-900" />
          </div>
          <span className="text-sm font-medium">{message}</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
