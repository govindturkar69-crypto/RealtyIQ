import { TrendingDown, TrendingUp, Minus, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Verdict = "underpriced" | "overpriced" | "fair" | "unknown";

const MAP: Record<Verdict, { label: string; variant: "success" | "destructive" | "secondary" | "outline"; Icon: typeof Minus }> = {
  underpriced: { label: "Good deal — below estimate", variant: "success", Icon: TrendingDown },
  overpriced: { label: "Above estimate", variant: "destructive", Icon: TrendingUp },
  fair: { label: "Fairly priced", variant: "secondary", Icon: Minus },
  unknown: { label: "No estimate", variant: "outline", Icon: HelpCircle },
};

export function DealBadge({ verdict, deltaPct }: { verdict: Verdict; deltaPct: number | null }) {
  const { label, variant, Icon } = MAP[verdict] ?? MAP.unknown;
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3.5 w-3.5" />
      {label}{deltaPct != null && verdict !== "fair" ? ` (${deltaPct > 0 ? "+" : ""}${deltaPct}%)` : ""}
    </Badge>
  );
}
