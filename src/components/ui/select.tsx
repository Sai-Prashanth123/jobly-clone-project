import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Custom Select — replaces @radix-ui/react-select.
 *
 * Radix Select moves real DOM focus onto the currently-selected (or first)
 * option when its list opens, so arrow-key navigation starts there. For a
 * portaled, position:fixed option list, the browser's built-in "scroll the
 * newly-focused element into view" then mis-fires and snaps the WHOLE page
 * to scrollY:0 — confirmed via extensive local repro; not fixable via
 * config, avoidCollisions, positioning mode, or a global focus() patch (all
 * tried and verified ineffective — see the `select-scrolltop-needs-custom-
 * dropdown` note). This implementation never moves real DOM focus off the
 * trigger while the list is open — it uses the standard ARIA "virtual
 * focus" combobox/listbox pattern (aria-activedescendant + a plain
 * `activeValue` in React state driving the highlight), which makes the
 * browser's scroll-into-view behavior structurally impossible to trigger.
 *
 * Public API intentionally matches the old Radix-backed component
 * (Select/SelectTrigger/SelectContent/SelectItem/SelectValue/etc. with the
 * same prop names) so every existing call site works unchanged.
 */

interface ItemInfo {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  activeValue: string | null;
  setActiveValue: (value: string | null) => void;
  items: ItemInfo[];
  setItems: (items: ItemInfo[]) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  baseId: string;
  selectItem: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(component: string): SelectContextValue {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error(`<${component} /> must be used within <Select>`);
  return ctx;
}

// ── Root ─────────────────────────────────────────────────────────────────

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

function Select({ value, onValueChange, defaultValue, disabled, children }: SelectProps) {
  const [open, setOpenState] = React.useState(false);
  const [activeValue, setActiveValue] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<ItemInfo[]>([]);
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? "");
  const triggerRef = React.useRef<HTMLButtonElement>(null!);
  const contentRef = React.useRef<HTMLDivElement>(null!);
  const baseId = React.useId();

  const currentValue = value !== undefined ? value : uncontrolledValue;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (disabled) return;
      setOpenState(next);
      if (next) {
        // Seed the highlight from the current selection (or the first
        // enabled item) each time the list opens — matches native <select>
        // / Radix behaviour without ever touching real DOM focus.
        setActiveValue(prev => {
          if (prev && items.some(i => i.value === prev && !i.disabled)) return prev;
          const selected = items.find(i => i.value === currentValue && !i.disabled);
          if (selected) return selected.value;
          const firstEnabled = items.find(i => !i.disabled);
          return firstEnabled ? firstEnabled.value : null;
        });
      }
    },
    [disabled, items, currentValue],
  );

  const selectItem = React.useCallback(
    (v: string) => {
      if (value === undefined) setUncontrolledValue(v);
      onValueChange?.(v);
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    },
    [value, onValueChange, setOpen],
  );

  // Close on outside pointerdown, Escape, or the page scrolling (a simple
  // ephemeral popup that closes on scroll sidesteps the entire class of
  // "reposition a portaled fixed element while the page moves" bugs this
  // rewrite exists to get away from).
  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }
    };
    const handleScroll = (e: Event) => {
      // Ignore scrolls originating from inside the listbox itself (mouse
      // wheel, scrollbar drag, scrollbar arrow click) — capture-phase
      // listeners see these too even though `scroll` doesn't bubble, so
      // without this guard the popup closes the instant its own list tries
      // to scroll instead of actually scrolling.
      if (contentRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, setOpen]);

  const ctx: SelectContextValue = {
    value: currentValue,
    onValueChange,
    disabled,
    open,
    setOpen,
    activeValue,
    setActiveValue,
    items,
    setItems,
    triggerRef,
    contentRef,
    baseId,
    selectItem,
  };

  return <SelectContext.Provider value={ctx}>{children}</SelectContext.Provider>;
}

// ── Value display ────────────────────────────────────────────────────────

function SelectValue({ placeholder, className }: { placeholder?: string; className?: string }) {
  const { value, items } = useSelectContext("SelectValue");
  const match = items.find(i => i.value === value);
  return (
    <span className={cn("pointer-events-none truncate", className)}>
      {match ? match.label : <span className="text-muted-foreground">{placeholder}</span>}
    </span>
  );
}

// ── Trigger ──────────────────────────────────────────────────────────────

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, onClick, onKeyDown, ...props }, forwardedRef) => {
    const { open, setOpen, disabled, triggerRef, activeValue, setActiveValue, items, selectItem, baseId } =
      useSelectContext("SelectTrigger");
    const ref = useMergedRefs(triggerRef, forwardedRef);

    const moveActive = (dir: 1 | -1) => {
      const enabled = items.filter(i => !i.disabled);
      if (enabled.length === 0) return;
      const idx = enabled.findIndex(i => i.value === activeValue);
      const next = idx === -1 ? (dir === 1 ? 0 : enabled.length - 1) : (idx + dir + enabled.length) % enabled.length;
      setActiveValue(enabled[next].value);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${baseId}-listbox`}
        aria-activedescendant={open && activeValue ? `${baseId}-option-${activeValue}` : undefined}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          className,
        )}
        onClick={(e) => {
          onClick?.(e);
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) setOpen(true);
            else moveActive(e.key === "ArrowDown" ? 1 : -1);
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) { if (activeValue) selectItem(activeValue); }
            else setOpen(true);
          }
        }}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" aria-hidden="true" />
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

// ── Content (portaled listbox) ───────────────────────────────────────────

// Walks the children tree (through SelectGroup wrappers) to build a flat
// value/label list — this runs on every render regardless of `open`, so
// SelectValue can always resolve the current selection's label even before
// the list has ever been opened (no "mount once to register" timing games).
function collectItems(children: React.ReactNode): ItemInfo[] {
  const out: ItemInfo[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
    if (child.type === SelectItem) {
      out.push({ value: props.value ?? "", label: props.children, disabled: props.disabled });
    } else if (props.children) {
      out.push(...collectItems(props.children));
    }
  });
  return out;
}

interface Position {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

function computePosition(trigger: HTMLElement): Position {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const floor = 128; // 8rem — never shrink the list below a usable size
  const cap = 384; // 24rem — never grow it past a reasonable size either
  const roomBelow = window.innerHeight - rect.bottom - gap;
  const roomAbove = rect.top - gap;
  const openAbove = roomBelow < floor && roomAbove > roomBelow;
  const available = openAbove ? roomAbove : roomBelow;
  const maxHeight = Math.max(floor, Math.min(cap, available));
  return {
    top: openAbove ? undefined : rect.bottom + gap,
    bottom: openAbove ? window.innerHeight - rect.top + gap : undefined,
    left: rect.left,
    width: rect.width,
    maxHeight,
  };
}

interface SelectContentProps {
  children?: React.ReactNode;
  className?: string;
  /** Accepted for API compatibility with the old Radix-backed component; this
   * implementation always uses popper-style viewport positioning. */
  position?: "popper" | "item-aligned";
}

function SelectContent({ children, className }: SelectContentProps) {
  const { open, setOpen, contentRef, setItems, activeValue, setActiveValue, selectItem, baseId } =
    useSelectContext("SelectContent");
  const [pos, setPos] = React.useState<Position | null>(null);
  const { triggerRef } = useSelectContext("SelectContent");

  const flatItems = React.useMemo(() => collectItems(children), [children]);
  React.useEffect(() => setItems(flatItems), [flatItems, setItems]);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) { setPos(null); return; }
    setPos(computePosition(triggerRef.current));
  }, [open, triggerRef]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        if (activeValue) { e.preventDefault(); selectItem(activeValue); }
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const enabled = flatItems.filter(i => !i.disabled);
        if (enabled.length === 0) return;
        const idx = enabled.findIndex(i => i.value === activeValue);
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const next = idx === -1 ? (dir === 1 ? 0 : enabled.length - 1) : (idx + dir + enabled.length) % enabled.length;
        setActiveValue(enabled[next].value);
      } else if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
        // Typeahead: jump to the next enabled item whose label starts with
        // the typed character(s), matching native <select> behaviour.
        const enabled = flatItems.filter(i => !i.disabled);
        const text = (v: React.ReactNode) => (typeof v === "string" ? v : "").toLowerCase();
        const key = e.key.toLowerCase();
        const startIdx = Math.max(0, enabled.findIndex(i => i.value === activeValue) + 1);
        const ordered = [...enabled.slice(startIdx), ...enabled.slice(0, startIdx)];
        const found = ordered.find(i => text(i.label).startsWith(key));
        if (found) setActiveValue(found.value);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, activeValue, flatItems, selectItem, setActiveValue]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={contentRef}
      id={`${baseId}-listbox`}
      role="listbox"
      className={cn(
        // Explicit pointer-events-auto: this listbox is portaled straight to
        // document.body as a DOM sibling of any Radix Dialog it's logically
        // nested inside. Radix Dialog sets `body.style.pointerEvents = 'none'`
        // while modal and only re-enables `auto` on its own DialogContent
        // subtree — a plain CSS-inherited `none` on body would otherwise make
        // this listbox fully unclickable (confirmed via live repro: it renders
        // on top but every click silently passes through to whatever's behind
        // it) while looking completely normal, so it must opt back in itself.
        "fixed z-50 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md p-1 pointer-events-auto",
        className,
      )}
      style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
    >
      {children}
    </div>,
    document.body,
  );
}

// ── Item ─────────────────────────────────────────────────────────────────

interface SelectItemProps {
  value: string;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

function SelectItem({ value, children, disabled, className }: SelectItemProps) {
  const { value: selectedValue, activeValue, setActiveValue, selectItem, baseId } = useSelectContext("SelectItem");
  const isSelected = selectedValue === value;
  const isActive = activeValue === value;

  return (
    <div
      id={`${baseId}-option-${value}`}
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
        disabled ? "pointer-events-none opacity-50" : "",
        isActive && !disabled ? "bg-accent text-accent-foreground" : "",
        className,
      )}
      onPointerEnter={() => { if (!disabled) setActiveValue(value); }}
      onClick={() => { if (!disabled) selectItem(value); }}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      {children}
    </div>
  );
}

// ── Structural passthroughs (no grouped/labelled Select is used in this
// app today, but kept for API completeness) ─────────────────────────────

function SelectGroup({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={className} role="group">{children}</div>;
}

function SelectLabel({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}>{children}</div>;
}

function SelectSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} role="separator" />;
}

// Native scrolling handles overflow in this implementation, so these are
// inert — kept only so any existing import of them doesn't break.
function SelectScrollUpButton() { return null; }
function SelectScrollDownButton() { return null; }

// ── Utility ──────────────────────────────────────────────────────────────

function useMergedRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return React.useCallback((node: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as React.MutableRefObject<T>).current = node;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refs);
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
