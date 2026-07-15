"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(v: LoginInput) {
    setLoading(true);
    try { await login(v.email, v.password); toast.success("Welcome back"); router.push("/dashboard"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Login failed"); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard title="Log in" description="Access your predictions and saved searches"
      footer={<>Don&apos;t have an account? <Link href="/signup" className="text-primary hover:underline">Sign up</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <Input type="password" placeholder="••••••••" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">Demo: demo@realtyiq.dev / Demo@12345</p>
    </AuthCard>
  );
}
