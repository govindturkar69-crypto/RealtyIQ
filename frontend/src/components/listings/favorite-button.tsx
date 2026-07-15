"use client";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/favorites-context";
import { cn } from "@/lib/utils";

export function FavoriteButton({ id, className }: { id: string; className?: string }) {
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const router = useRouter();
  const active = isFavorite(id);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Log in to save favorites");
      router.push("/login");
      return;
    }
    toggle(id);
  }

  return (
    <button type="button" onClick={onClick} aria-label="Save to favorites"
      className={cn("rounded-full bg-background/80 p-2 backdrop-blur transition hover:bg-background", className)}>
      <Heart className={cn("h-4 w-4", active ? "fill-red-500 text-red-500" : "text-foreground")} />
    </button>
  );
}
