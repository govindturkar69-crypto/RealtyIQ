import { jsPDF } from "jspdf";
import type { PredictionResult } from "./types";
import type { PredictInput } from "./schemas";
import { formatINR } from "./utils";

export function generateValuationPdf(input: PredictInput, result: PredictionResult) {
  const doc = new jsPDF();
  const now = new Date().toLocaleString("en-IN");
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255).setFontSize(20).text("RealtyIQ — Valuation Report", 14, 18);

  doc.setTextColor(30).setFontSize(10).text(`Generated: ${now}`, 14, 38);
  doc.text(`Model: ${result.model_name}`, 14, 44);

  doc.setFontSize(14).text("Estimated value", 14, 58);
  doc.setFontSize(24).setTextColor(37, 99, 235).text(formatINR(result.predicted_price), 14, 70);
  doc.setFontSize(10).setTextColor(80)
    .text(`95% confidence: ${formatINR(result.confidence_low)}  -  ${formatINR(result.confidence_high)}`, 14, 78);
  doc.text(`Price per sqft: Rs ${result.price_per_sqft.toLocaleString("en-IN")}`, 14, 84);

  doc.setTextColor(30).setFontSize(14).text("Property details", 14, 100);
  const rows: [string, string][] = [
    ["Locality", input.location],
    ["Area type", input.area_type],
    ["Availability", input.availability_status],
    ["Total area", `${input.total_sqft} sqft`],
    ["Bedrooms", `${input.bhk} BHK`],
    ["Bathrooms", String(input.bath)],
    ["Balconies", String(input.balcony)],
  ];
  let y = 110;
  doc.setFontSize(11);
  rows.forEach(([k, v]) => {
    doc.setTextColor(110).text(k, 14, y);
    doc.setTextColor(30).text(String(v), 80, y);
    y += 8;
  });

  doc.setDrawColor(220).line(14, y + 4, 196, y + 4);
  doc.setFontSize(8).setTextColor(140).text(
    "This estimate is model-generated for informational purposes only and is not financial advice.",
    14, y + 12, { maxWidth: 180 }
  );

  doc.save(`RealtyIQ-valuation-${input.location.replace(/\s+/g, "-")}.pdf`);
}
