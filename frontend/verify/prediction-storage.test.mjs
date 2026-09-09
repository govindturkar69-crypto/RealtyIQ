import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { parseStoredPrediction } from "../src/lib/prediction-storage.ts";

const storedSchema = z.object({
  input: z.object({ location: z.string().min(1) }),
  result: z.object({ predicted_price: z.number().finite() }),
});
const safeParse = (value) => storedSchema.safeParse(value);

test("invalid prediction JSON is rejected without throwing", () => {
  assert.equal(parseStoredPrediction("not-valid json", safeParse), null);
});

test("missing, empty, null, and schema-invalid storage are rejected", () => {
  assert.equal(parseStoredPrediction(null, safeParse), null);
  assert.equal(parseStoredPrediction("", safeParse), null);
  assert.equal(parseStoredPrediction("null", safeParse), null);
  assert.equal(parseStoredPrediction(JSON.stringify({ input: {} }), safeParse), null);
});

test("valid stored prediction data is preserved", () => {
  const value = { input: { location: "Whitefield" }, result: { predicted_price: 1 } };
  assert.deepEqual(parseStoredPrediction(JSON.stringify(value), safeParse), value);
});
