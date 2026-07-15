import { test } from "node:test";
import assert from "node:assert/strict";
import { geoFor, LOCALITY_GEO } from "../seed/geo.js";

test("known locality returns mapped coords", () => {
  assert.deepEqual(geoFor("Whitefield"), LOCALITY_GEO["Whitefield"]);
});

test("unknown locality is deterministic and near Bengaluru", () => {
  const a = geoFor("Nowhere Nagar");
  const b = geoFor("Nowhere Nagar");
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.lat - 12.9716) < 0.2 && Math.abs(a.lng - 77.5946) < 0.2);
});
