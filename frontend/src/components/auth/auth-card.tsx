"use client";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function AuthCard({ title, description, children, footer }: {
  title: string; description: string; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold">
        <Building2 className="h-6 w-6 text-primary" /> RealtyIQ
      </Link>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>
    </div>
  );
}
