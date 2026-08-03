import type { ParsedSaludPdf } from "@/modules/salud/types/salud.types";

const TYPE_PATTERNS: { type: string; re: RegExp }[] = [
  { type: "vacuna", re: /vacun/i },
  { type: "desparasitante", re: /desparasit|ivermect|albendaz/i },
  { type: "antibiótico", re: /antibi[oó]tic|penicil|oxitetrac/i },
  { type: "vitamina", re: /vitamin/i },
  { type: "implante", re: /implant/i },
  { type: "anabólico", re: /anab[oó]lic/i },
];

function pickDate(text: string): string | undefined {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const dmy = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  return undefined;
}

function pickMoney(text: string): number | undefined {
  const m = text.match(
    /(?:₡|CRC|total|monto|costo)[^\d]{0,12}([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i
  );
  if (!m) return undefined;
  const raw = m[1].replace(/\./g, "").replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function pickAppliedBy(text: string): string | undefined {
  const m = text.match(
    /(?:aplicad[oa]\s+por|veterinari[oa]|dr\.?|dra\.?)[:\s]+([A-Za-zÁÉÍÓÚÑáéíóúñ. ]{3,60})/i
  );
  return m?.[1]?.trim();
}

function pickName(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 4 && l.length <= 80);
  for (const line of lines) {
    if (/vacun|tratamiento|medicament|producto/i.test(line)) {
      return line.replace(/^[:\-\s]+/, "").slice(0, 80);
    }
  }
  return lines[0];
}

function pickAnimalCount(text: string): number | undefined {
  const m = text.match(
    /(?:animales|cabezas|cantidad|n[°º]?\s*animales)[^\d]{0,10}(\d{1,4})/i
  );
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseSaludPdfText(rawText: string): ParsedSaludPdf {
  const text = rawText.replace(/\u0000/g, " ").trim();
  let type = "vacuna";
  for (const p of TYPE_PATTERNS) {
    if (p.re.test(text)) {
      type = p.type;
      break;
    }
  }

  const totalCost = pickMoney(text);
  const animalCount = pickAnimalCount(text) ?? 1;
  const costPerAnimal =
    totalCost != null && animalCount > 0
      ? Math.round((totalCost / animalCount) * 100) / 100
      : undefined;

  return {
    name: pickName(text) ?? "Tratamiento importado",
    type,
    date: pickDate(text) ?? new Date().toISOString().slice(0, 10),
    appliedBy: pickAppliedBy(text),
    animalCount,
    totalCost,
    costPerAnimal,
    notes: text.slice(0, 500),
    rawText: text,
  };
}
