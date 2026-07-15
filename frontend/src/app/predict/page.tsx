import { PredictForm } from "@/components/predict/predict-form";

export default function PredictPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Estimate a property price</h1>
        <p className="mt-2 text-muted-foreground">Fill in the details and our ML model returns a valuation with a confidence range.</p>
      </div>
      <PredictForm />
    </div>
  );
}
