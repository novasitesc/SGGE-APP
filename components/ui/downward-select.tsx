"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type DownwardSelectOption = { value: string; label: string };
export type DownwardSelectGroup = { label: string; options: DownwardSelectOption[] };

export function DownwardSelect({
  id,
  value,
  onValueChange,
  groups,
  options,
  className,
  disabled,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  groups?: DownwardSelectGroup[];
  options?: DownwardSelectOption[];
  className?: string;
  disabled?: boolean;
}) {
  const flat = groups?.flatMap((g) => g.options) ?? options ?? [];
  const selected = flat.find((o) => o.value === value);

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
          avoidCollisions={false}
          className="z-[80] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border bg-background py-1 shadow-lg"
        >
          {groups
            ? groups.map((group) => (
                <SelectPrimitive.Group key={group.label}>
                  <SelectPrimitive.Label className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    {group.label}
                  </SelectPrimitive.Label>
                  {group.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} label={opt.label} />
                  ))}
                </SelectPrimitive.Group>
              ))
            : (options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value} label={opt.label} />
              ))}
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function SelectItem({ value, label }: { value: string; label: string }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex cursor-pointer select-none items-center py-2 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground"
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex">
        <Check className="h-3.5 w-3.5" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
