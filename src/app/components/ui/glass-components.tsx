import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GlassCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { hoverEffect?: boolean }
>(({ className, hoverEffect = false, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-white/10 bg-slate-800/50 p-6 backdrop-blur-md shadow-xl transition-all duration-300",
        hoverEffect && "hover:bg-slate-800/60 hover:shadow-2xl hover:-translate-y-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
GlassCard.displayName = "GlassCard";

export const GlassButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }
>(({ className, variant = "primary", children, ...props }, ref) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20",
    secondary: "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20",
    danger: "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20",
    ghost: "bg-transparent hover:bg-white/10 text-white border border-white/20",
  };

  return (
    <button
      ref={ref}
      className={cn(
        "relative flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
GlassButton.displayName = "GlassButton";

export const GlassInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode; error?: string }
>(({ className, icon, error, ...props }, ref) => {
  return (
    <div className="w-full space-y-1">
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white placeholder-gray-400 outline-none transition-all duration-300 focus:border-blue-500/50 focus:bg-slate-800/60 focus:ring-2 focus:ring-blue-500/20",
            icon && "pl-10",
            error && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400 pl-1">{error}</p>}
    </div>
  );
});
GlassInput.displayName = "GlassInput";

export const GlassDropdown = ({
  trigger,
  items,
  align = "right",
}: {
  trigger: React.ReactNode;
  items: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "danger";
  }[];
  align?: "left" | "right";
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-slate-800/90 backdrop-blur-xl shadow-xl transition-all animate-in fade-in zoom-in-95 duration-200",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="p-1">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  item.variant === "danger"
                    ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
