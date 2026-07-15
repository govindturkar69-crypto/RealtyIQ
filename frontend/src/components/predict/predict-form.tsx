"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { predictSchema, type PredictInput } from "@/lib/schemas";
import type { LocalityEnums, PredictionResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";

const STEP_FIELDS: (keyof PredictInput)[][] = [
  ["location", "area_type", "availability_status"],
  ["total_sqft", "bhk", "bath", "balcony"],
  [],
];
const STEP_TITLES = ["Location & type", "Size & rooms", "Review"];

export function PredictForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [enums, setEnums] = useState<LocalityEnums | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<PredictInput>({
    resolver: zodResolver(predictSchema),
    mode: "onChange",
    defaultValues: {
      location: "", area_type: "Super built-up Area", availability_status: "Ready To Move",
      total_sqft: 1200, bhk: 2, bath: 2, balcony: 1,
    },
  });
  const { register, handleSubmit, trigger, getValues, watch, formState: { errors } } = form;

  useEffect(() => {
    api.localities()
      .then((e) => {
        const en = e as LocalityEnums;
        setEnums(en);
        const locs = en.categorical?.location;
        if (locs?.length) form.setValue("location", locs.includes("Whitefield") ? "Whitefield" : locs[0]);
      })
      .catch(() => toast.error("Could not load locality options. Is the API running?"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function next() {
    const ok = await trigger(STEP_FIELDS[step]);
    if (ok) setStep((s) => Math.min(s + 1, 2));
  }

  async function onSubmit(values: PredictInput) {
    setSubmitting(true);
    try {
      const result = (await api.predict(values)) as PredictionResult;
      sessionStorage.setItem("riq_prediction", JSON.stringify({ input: values, result }));
      toast.success("Valuation ready");
      router.push("/results");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setSubmitting(false);
    }
  }

  const locations = enums?.categorical?.location ?? [];
  const areaTypes = enums?.categorical?.area_type ?? ["Super built-up Area", "Built-up Area", "Plot Area", "Carpet Area"];
  const v = watch();

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="mb-4 flex items-center gap-2">
          {STEP_TITLES.map((t, i) => (
            <div key={t} className="flex flex-1 items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEP_TITLES.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <CardTitle>{STEP_TITLES[step]}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {step === 0 && (
            <>
              <Field label="Locality" error={errors.location?.message}>
                <Select {...register("location")}>
                  {locations.length === 0 && <option value="">Loading…</option>}
                  {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Area type" error={errors.area_type?.message}>
                <Select {...register("area_type")}>
                  {areaTypes.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
              </Field>
              <Field label="Availability" error={errors.availability_status?.message}>
                <Select {...register("availability_status")}>
                  <option value="Ready To Move">Ready To Move</option>
                  <option value="Under Construction">Under Construction</option>
                </Select>
              </Field>
            </>
          )}
          {step === 1 && (
            <>
              <Field label="Total area (sqft)" error={errors.total_sqft?.message}>
                <Input type="number" step="any" {...register("total_sqft")} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="BHK" error={errors.bhk?.message}>
                  <Input type="number" {...register("bhk")} />
                </Field>
                <Field label="Bathrooms" error={errors.bath?.message}>
                  <Input type="number" {...register("bath")} />
                </Field>
                <Field label="Balconies" error={errors.balcony?.message}>
                  <Input type="number" {...register("balcony")} />
                </Field>
              </div>
            </>
          )}
          {step === 2 && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries({
                Locality: v.location, "Area type": v.area_type, Availability: v.availability_status,
                "Total sqft": v.total_sqft, BHK: v.bhk, Bathrooms: v.bath, Balconies: v.balcony,
              }).map(([k, val]) => (
                <div key={k} className="rounded-md border p-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{String(val)}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < 2 ? (
              <Button type="button" onClick={next}>Next <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Get valuation
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
