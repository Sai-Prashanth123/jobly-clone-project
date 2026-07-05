import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          // "sonner-toast-item" instead of the bare "toast" class — this app
          // also bundles Bootstrap (for the public site) into the same
          // stylesheet, and Bootstrap's own
          // `.toast:not(.showing):not(.show){opacity:0}` rule has higher
          // specificity than Sonner's `:where()`-based visibility rule, so a
          // literal "toast" class here silently won and kept every toast at
          // opacity:0 forever. The group-[...] children below must reference
          // the same renamed class to keep finding this element as their
          // ancestor.
          toast:
            "group sonner-toast-item group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.sonner-toast-item]:text-muted-foreground",
          actionButton: "group-[.sonner-toast-item]:bg-primary group-[.sonner-toast-item]:text-primary-foreground",
          cancelButton: "group-[.sonner-toast-item]:bg-muted group-[.sonner-toast-item]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
