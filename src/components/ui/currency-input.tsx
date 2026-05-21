import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number | string | null | undefined;
  onValueChange: (value: number | null) => void;
  showPrefix?: boolean;
  placeholder?: string;
  allowNegative?: boolean;
}

export function parseBRLToNumber(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;

  const raw = String(input).trim();
  if (!raw) return null;

  const isNegative = raw.startsWith("-");
  const cleaned = raw.replace(/R\$\s?/gi, "").replace(/\s/g, "").replace(/^-/, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const value = parseFloat(normalized);
  if (Number.isNaN(value)) return null;
  return isNegative ? -value : value;
}

export function formatNumberBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onValueChange,
      showPrefix = true,
      placeholder = "0,00",
      allowNegative = false,
      className,
      onBlur,
      onFocus,
      autoFocus,
      ...props
    },
    ref,
  ) => {
    const toCents = React.useCallback((nextValue: number | string | null | undefined): number => {
      const parsed = parseBRLToNumber(nextValue);
      if (parsed === null) return 0;
      return Math.round(parsed * 100);
    }, []);

    const initialCents = toCents(value);
    const [cents, setCents] = React.useState<number>(Math.abs(initialCents));
    const [negative, setNegative] = React.useState<boolean>(initialCents < 0);
    const isEditingRef = React.useRef(false);

    React.useEffect(() => {
      if (isEditingRef.current) return;
      const next = toCents(value);
      setCents(Math.abs(next));
      setNegative(allowNegative && next < 0);
    }, [allowNegative, toCents, value]);

    const emit = (nextCents: number, nextNegative = negative) => {
      const absolute = Math.abs(nextCents);
      const signed = allowNegative && nextNegative && absolute > 0 ? -absolute : absolute;
      setCents(absolute);
      setNegative(allowNegative && nextNegative && absolute > 0);
      onValueChange(signed / 100);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      isEditingRef.current = true;
      const digits = event.target.value.replace(/\D/g, "").slice(0, 14);
      const next = digits === "" ? 0 : parseInt(digits, 10);
      emit(next, allowNegative && event.target.value.trim().startsWith("-"));
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (allowNegative && event.key === "-") {
        event.preventDefault();
        isEditingRef.current = true;
        emit(cents, !negative);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        isEditingRef.current = true;
        emit(Math.floor(cents / 10));
      }
    };

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      isEditingRef.current = true;
      requestAnimationFrame(() => event.target.select());
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      isEditingRef.current = false;
      onBlur?.(event);
    };

    const display = `${negative ? "-" : ""}${formatNumberBRL(cents / 100)}`;

    return (
      <div className="relative">
        {showPrefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            R$
          </span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode={allowNegative ? "text" : "numeric"}
          value={display}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={cn(showPrefix && "pl-9", "text-right tabular-nums", className)}
          {...props}
        />
      </div>
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";
