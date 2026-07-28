"use client";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Auth3D } from "@/components/three/auth-3d";

export function AuthShell({ title, description, children, footer }: {
  title: string; description: string; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-violet-500/10 p-8 lg:flex lg:h-[560px] lg:flex-col">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <Building2 className="h-6 w-6 text-primary" /> RealtyIQ
        </Link>
        <div className="flex-1"><Auth3D /></div>
        <div>
          <h2 className="text-2xl font-bold">Value any property with ML</h2>
          <p className="mt-2 text-muted-foreground">Predictions with confidence ranges, market trends, and full explainability.</p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold lg:hidden">
          <Building2 className="h-6 w-6 text-primary" /> RealtyIQ
        </Link>
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}
