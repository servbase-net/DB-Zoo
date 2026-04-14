import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "secondary" | "destructive" | "outline" }) {
  const styles = {
    default: "bg-primary/15 text-primary",
    secondary: "bg-muted text-muted-foreground",
    destructive: "bg-destructive/15 text-destructive",
    outline: "border border-border text-foreground",
  }[variant];
  return <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", styles, className)} {...props} />;
}
