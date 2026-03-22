function sanitizeDecimal(value) {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const firstDotIndex = cleaned.indexOf(".");

  if (firstDotIndex === -1) return cleaned;

  const integerPart = cleaned.slice(0, firstDotIndex + 1);
  const decimalPart = cleaned.slice(firstDotIndex + 1).replace(/\./g, "");
  return integerPart + decimalPart;
}

function normalizeRiskInput(value) {
  const cleaned = sanitizeDecimal(value);
  if (!cleaned) return "";

  if (cleaned.endsWith(".")) {
    const integerPartOnly = cleaned.slice(0, -1) || "0";
    return `${integerPartOnly}.`;
  }

  const parts = cleaned.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = (parts[1] || "").slice(0, 2);

  return decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
}