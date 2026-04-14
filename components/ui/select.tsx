import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "onChange" | "value" | "defaultValue"
> & {
  children?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  searchable = false,
  searchPlaceholder = "Search...",
  ...props
}: SelectProps) {
  const options = React.useMemo(
    () =>
      React.Children.toArray(children)
        .filter((child): child is React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>> =>
          React.isValidElement(child),
        )
        .map((child) => {
          const fallbackLabel = String(child.props.children ?? "");
          const value =
            child.props.value !== undefined && child.props.value !== null
              ? String(child.props.value)
              : fallbackLabel;
          return {
            value,
            label: fallbackLabel || value,
            disabled: Boolean(child.props.disabled),
          };
        }),
    [children],
  );

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q));
  }, [options, search]);

  const selected = value ?? defaultValue ?? options[0]?.value ?? "";

  const triggerBase =
    "flex h-10 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-sm transition-colors focus:border-primary/55 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <SelectPrimitive.Root
      value={selected}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch("");
        }
      }}
      onValueChange={(nextValue) => {
        if (!onChange) return;
        onChange({
          target: { value: nextValue },
          currentTarget: { value: nextValue },
        } as unknown as React.ChangeEvent<HTMLSelectElement>);
      }}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger className={cn(triggerBase, className)} aria-label={props["aria-label"]}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[220px] overflow-hidden rounded-md border border-border bg-card shadow-lg"
        >
          {searchable ? (
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none transition-colors focus:border-primary/55"
                />
              </div>
            </div>
          ) : null}
          <SelectPrimitive.Viewport className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50"
              >
                <span className="absolute left-2 inline-flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3.5 w-3.5" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No matching options</div>
            ) : null}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
