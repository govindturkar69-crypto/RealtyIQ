"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { signupSchema, type SignupInput } from "@/lib/schemas";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(v: SignupInput) {
    setLoading(true);
    try { await signup(v.name, v.email, v.password); toast.success("Account created"); router.push("/dashboard"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Signup failed"); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard title="Create account" description="Start valuing properties in seconds"
      footer={<>Already have an account? <Link href="/login" className="text-primary hover:underline">Log in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input placeholder="Your name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <Input type="password" placeholder="Min 8 characters" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign up
        </Button>
      </form>
    </AuthCard>
  );
}
