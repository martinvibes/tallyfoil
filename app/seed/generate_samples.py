"""
Generates the Tallyfoil demo sample set: contract PDFs, invoice PDFs,
a usage-export CSV, and expected-findings.json.

All vendors and customers are FICTIONAL. Every document carries a
"SAMPLE DOCUMENT" footer so nothing can be mistaken for a real bill.

Run:  python3 seed/generate_samples.py   (needs: pip install reportlab)
Output goes to app/seed/sample-docs/ and app/seed/expected-findings.json
"""
from __future__ import annotations

import csv
import json
import random
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

OUT = Path(__file__).parent / "sample-docs"
OUT.mkdir(parents=True, exist_ok=True)

CUSTOMER = "Kestrel Labs Ltd"
FOOTER = "SAMPLE DOCUMENT - fictional vendor and customer, generated for the Tallyfoil demo."


def money(d: Decimal) -> str:
    return f"{d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):,.2f}"


def write_pdf(path: Path, title: str, lines: list[str]) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    w, h = A4
    y = h - 25 * mm
    c.setFont("Helvetica-Bold", 15)
    c.drawString(20 * mm, y, title)
    y -= 10 * mm
    c.setFont("Helvetica", 10)
    for line in lines:
        if y < 25 * mm:
            c.setFont("Helvetica-Oblique", 7)
            c.drawString(20 * mm, 12 * mm, FOOTER)
            c.showPage()
            c.setFont("Helvetica", 10)
            y = h - 25 * mm
        c.drawString(20 * mm, y, line)
        y -= 5.5 * mm
    c.setFont("Helvetica-Oblique", 7)
    c.drawString(20 * mm, 12 * mm, FOOTER)
    c.save()


# ---------------------------------------------------------------- Cobalt (SaaS seats)

COBALT_CONTRACT = [
    "Cobalt Workspace Inc.  |  Order Form CW-2025-0207",
    "",
    f"Customer: {CUSTOMER}",
    "Product: Cobalt Workspace Business",
    "Order Form effective date: February 1, 2025",
    "",
    "1. Initial Term. February 1, 2025 through January 31, 2026.",
    "",
    "2. Subscription Fee. USD 24.00 per seat per month, billed monthly in advance.",
    "",
    "3. Licensed Seats. 40 seats. Customer may not exceed 40 seats without a",
    "   mutually executed Order Form or Customer's written approval.",
    "",
    "4. Renewal. This Order Form renews automatically for successive 12-month",
    "   terms unless either party gives written notice of non-renewal at least",
    "   60 days before the end of the then-current term.",
    "",
    "5. Price Changes. On renewal, Cobalt may increase per-seat fees by no more",
    "   than 5% over the fees in effect during the immediately preceding term.",
    "",
    "6. Invoices. Each invoice states the billing period, seat quantity, unit",
    "   price and total. Duplicate charges will be credited on request.",
    "",
    "Signed for Cobalt Workspace Inc.: R. Okafor, VP Sales",
    f"Signed for {CUSTOMER}: M. Adeyemi, Head of Operations",
]


@dataclass
class CobaltInvoice:
    number: str
    date: str
    period_start: str
    period_end: str
    period_label: str
    seats: int
    unit: Decimal


cobalt_invoices: list[CobaltInvoice] = []
months = [
    ("2025-11", "November 2025", "2025-11-01", "2025-11-30"),
    ("2025-12", "December 2025", "2025-12-01", "2025-12-31"),
    ("2026-01", "January 2026", "2026-01-01", "2026-01-31"),
    ("2026-02", "February 2026", "2026-02-01", "2026-02-28"),
    ("2026-03", "March 2026", "2026-03-01", "2026-03-31"),
    ("2026-04", "April 2026", "2026-04-01", "2026-04-30"),
    ("2026-05", "May 2026", "2026-05-01", "2026-05-31"),
    ("2026-06", "June 2026", "2026-06-01", "2026-06-30"),
    ("2026-07", "July 2026", "2026-07-01", "2026-07-31"),
    ("2026-08", "August 2026", "2026-08-01", "2026-08-31"),
    ("2026-09", "September 2026", "2026-09-01", "2026-09-30"),
    ("2026-10", "October 2026", "2026-10-01", "2026-10-31"),
]
num = 1031
for key, label, ps, pe in months:
    renewed = key >= "2026-02"
    unit = Decimal("26.16") if renewed else Decimal("24.00")
    seats = 48 if key >= "2026-04" else 40
    cobalt_invoices.append(CobaltInvoice(f"INV-{num}", ps, ps, pe, label, seats, unit))
    num += 1
    if key == "2026-07":  # planted duplicate: same period, same amount, new number
        cobalt_invoices.append(
            CobaltInvoice(f"INV-{num}", "2026-07-06", ps, pe, label, seats, unit)
        )
        num += 1

write_pdf(OUT / "cobalt-order-form-CW-2025-0207.pdf", "Order Form", COBALT_CONTRACT)

for inv in cobalt_invoices:
    amount = inv.unit * inv.seats
    lines = [
        "Cobalt Workspace Inc.",
        "",
        f"Invoice No.: {inv.number}",
        f"Invoice Date: {inv.date}",
        f"Bill To: {CUSTOMER}",
        "Reference: Order Form CW-2025-0207",
        f"Billing Period: {inv.period_start} to {inv.period_end} ({inv.period_label})",
        "",
        "Description                               Qty    Unit Price     Amount",
        f"Cobalt Workspace Business - seats         {inv.seats:<6} USD {money(inv.unit):<9}  USD {money(amount)}",
        "",
        f"Subtotal: USD {money(amount)}",
        "Tax: USD 0.00",
        f"Total Due: USD {money(amount)}",
        "",
        "Payment terms: Net 15. Thank you for your business.",
    ]
    write_pdf(OUT / f"cobalt-invoice-{inv.number}.pdf", "Invoice", lines)

# ---------------------------------------------------------------- Halcyon (AI usage)

HALCYON_CONTRACT = [
    "Halcyon AI Inc.  |  API Order Form HA-2026-114",
    "",
    f"Customer: {CUSTOMER}",
    "Effective date: January 1, 2026. Term: 12 months.",
    "",
    "1. Fees. API usage is billed monthly in arrears at the following rates:",
    "   halcyon-large: input USD 3.00 per 1M tokens; output USD 15.00 per 1M tokens.",
    "   halcyon-small: input USD 0.25 per 1M tokens; output USD 1.25 per 1M tokens.",
    "",
    "2. Usage Measurement. Billable usage equals the token counts shown in the",
    "   Customer's usage dashboard export for the billing period.",
    "",
    "3. Disputes. Customer may dispute any charge within 60 days of the invoice date.",
]
write_pdf(OUT / "halcyon-order-form-HA-2026-114.pdf", "API Order Form", HALCYON_CONTRACT)

RATES = {  # USD per 1M tokens, from the order form
    ("halcyon-large", "input"): Decimal("3.00"),
    ("halcyon-large", "output"): Decimal("15.00"),
    ("halcyon-small", "input"): Decimal("0.25"),
    ("halcyon-small", "output"): Decimal("1.25"),
}
LOGGED = {  # true usage in the dashboard export (tokens)
    ("halcyon-large", "input"): 389_000_000,
    ("halcyon-large", "output"): 61_000_000,
    ("halcyon-small", "input"): 900_000_000,
    ("halcyon-small", "output"): 120_000_000,
}
BILLED = [  # (model, direction, billed tokens, billed rate)
    ("halcyon-large", "input", 412_000_000, Decimal("3.00")),   # planted: 23M more than logged
    ("halcyon-large", "output", 61_000_000, Decimal("15.00")),
    ("halcyon-small", "input", 900_000_000, Decimal("0.30")),   # planted: rate above contract
    ("halcyon-small", "output", 120_000_000, Decimal("1.25")),
]
hal_lines = [
    "Halcyon AI Inc.",
    "",
    "Invoice No.: HAI-26-1007",
    "Invoice Date: 2026-11-03",
    f"Bill To: {CUSTOMER}",
    "Reference: API Order Form HA-2026-114",
    "Billing Period: 2026-10-01 to 2026-10-31 (October 2026)",
    "",
    "Description                          Tokens (M)   Rate per 1M    Amount",
]
hal_total = Decimal("0")
for model, direction, toks, rate in BILLED:
    amt = rate * Decimal(toks) / Decimal(1_000_000)
    hal_total += amt
    hal_lines.append(
        f"{model} {direction} tokens{'':<10} {toks // 1_000_000:<12} USD {money(rate):<9}  USD {money(amt)}"
    )
hal_lines += ["", f"Total Due: USD {money(hal_total)}", "", "Payment terms: Net 30."]
write_pdf(OUT / "halcyon-invoice-HAI-26-1007.pdf", "Invoice", hal_lines)

# usage export CSV with exact sums
rng = random.Random(42)


def split(total: int, parts: int) -> list[int]:
    weights = [rng.uniform(0.6, 1.4) for _ in range(parts)]
    s = sum(weights)
    vals = [int(total * w / s) for w in weights]
    vals[-1] += total - sum(vals)
    return vals


with open(OUT / "halcyon-usage-export-2026-10.csv", "w", newline="") as f:
    wr = csv.writer(f)
    wr.writerow(["date", "model", "input_tokens", "output_tokens", "requests"])
    for model in ("halcyon-large", "halcyon-small"):
        ins = split(LOGGED[(model, "input")], 31)
        outs = split(LOGGED[(model, "output")], 31)
        for day in range(31):
            wr.writerow(
                [f"2026-10-{day + 1:02d}", model, ins[day], outs[day], rng.randint(900, 4000)]
            )

# ---------------------------------------------------------------- expected findings


def cents(d: Decimal) -> int:
    return int((d * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def expected(seat_cap_rule: bool) -> dict:
    findings = []
    seen: dict[tuple, str] = {}
    base_price = Decimal("24.00")
    renewal_cap = base_price * Decimal("1.05")  # 25.20
    for inv in cobalt_invoices:
        key = (inv.period_start, inv.seats, inv.unit)
        if key in seen:
            findings.append({
                "check": "DUPLICATE_BILLING", "vendor": "Cobalt Workspace",
                "period": inv.period_label, "invoice": inv.number,
                "duplicates": seen[key], "amountCents": cents(inv.unit * inv.seats),
                "severity": "breach",
            })
            continue
        seen[key] = inv.number
        cap = 48 if (seat_cap_rule and inv.period_start >= "2026-04-01") else 40
        allowed_price = renewal_cap if inv.period_start >= "2026-02-01" else base_price
        if inv.seats > cap:
            findings.append({
                "check": "SEAT_CAP_EXCEEDED", "vendor": "Cobalt Workspace",
                "period": inv.period_label, "invoice": inv.number,
                "billedSeats": inv.seats, "cap": cap,
                "amountCents": cents((inv.seats - cap) * inv.unit), "severity": "verify",
            })
        if inv.unit > allowed_price:
            qty = min(inv.seats, cap)
            findings.append({
                "check": "PRICE_ABOVE_CONTRACT", "vendor": "Cobalt Workspace",
                "period": inv.period_label, "invoice": inv.number,
                "billedUnit": str(inv.unit), "allowedUnit": str(allowed_price.quantize(Decimal('0.01'))),
                "qty": qty, "amountCents": cents((inv.unit - allowed_price) * qty),
                "severity": "breach",
            })
    for model, direction, toks, rate in BILLED:
        logged = LOGGED[(model, direction)]
        contract = RATES[(model, direction)]
        if toks > logged:
            findings.append({
                "check": "USAGE_OVERBILLED", "vendor": "Halcyon AI",
                "period": "October 2026", "invoice": "HAI-26-1007",
                "meter": f"{model} {direction}", "billed": toks, "logged": logged,
                "amountCents": cents(Decimal(toks - logged) * contract / Decimal(1_000_000)),
                "severity": "breach",
            })
        if rate > contract:
            qty = min(toks, logged)
            findings.append({
                "check": "RATE_ABOVE_CONTRACT", "vendor": "Halcyon AI",
                "period": "October 2026", "invoice": "HAI-26-1007",
                "meter": f"{model} {direction}", "billedRate": str(rate), "contractRate": str(contract),
                "amountCents": cents((rate - contract) * Decimal(qty) / Decimal(1_000_000)),
                "severity": "breach",
            })
    at_risk = {
        "check": "RENEWAL_NOTICE_DEADLINE", "vendor": "Cobalt Workspace",
        "termEnd": "2027-01-31", "noticeDays": 60, "noticeDeadline": "2026-12-02",
        "atRiskCents": cents(Decimal("26.16") * 48 * 12), "severity": "deadline",
    }
    total = sum(f["amountCents"] for f in findings)
    by_check: dict[str, int] = {}
    for f in findings:
        by_check[f["check"]] = by_check.get(f["check"], 0) + f["amountCents"]
    return {"recoverableCents": total, "byCheckCents": by_check,
            "findingCount": len(findings), "findings": findings, "deadline": at_risk}


result = {
    "note": "Expected engine output for the sample set. Amounts are integer cents.",
    "beforeRule": expected(False),
    "afterRule_seatCap48FromApril2026": expected(True),
}
(Path(__file__).parent / "expected-findings.json").write_text(json.dumps(result, indent=2))

# ---------------------------------------------------------------- structured truth for engine tests


def micros(d: Decimal) -> int:
    return int(d * 1_000_000)


structured = {
    "note": "Ground truth of the sample set in engine units (cents, micros, tokens). "
            "Used by engine.test.ts. Evidence is omitted here; the engine does not need it.",
    "asOf": "2026-11-09",
    "vendors": [
        {
            "id": "v_cobalt", "name": "Cobalt Workspace", "kind": "seat_subscription",
            "terms": [
                {"key": "seat_price", "valueNum": micros(Decimal("24.00"))},
                {"key": "seat_cap", "valueNum": 40},
                {"key": "renewal_uplift_cap_bps", "valueNum": 500},
                {"key": "term_start", "valueDate": "2025-02-01"},
                {"key": "term_end", "valueDate": "2026-01-31"},
                {"key": "auto_renew", "valueNum": 1},
                {"key": "notice_days", "valueNum": 60},
            ],
            "invoices": [
                {
                    "invoiceNumber": i.number, "invoiceDate": i.date,
                    "periodStart": i.period_start, "periodEnd": i.period_end,
                    "totalCents": cents(i.unit * i.seats),
                    "lines": [{
                        "description": "Cobalt Workspace Business - seats",
                        "quantity": i.seats, "unitPriceMicros": micros(i.unit),
                        "amountCents": cents(i.unit * i.seats),
                    }],
                } for i in cobalt_invoices
            ],
            "usageTotals": [],
        },
        {
            "id": "v_halcyon", "name": "Halcyon AI", "kind": "usage_metered",
            "terms": [
                {"key": "meter_rate", "meter": f"{m} {d}", "valueNum": micros(r)}
                for (m, d), r in RATES.items()
            ] + [{"key": "billing_basis", "valueText": "usage_export"}],
            "invoices": [{
                "invoiceNumber": "HAI-26-1007", "invoiceDate": "2026-11-03",
                "periodStart": "2026-10-01", "periodEnd": "2026-10-31",
                "totalCents": cents(hal_total),
                "lines": [{
                    "description": f"{m} {d} tokens", "meter": f"{m} {d}",
                    "quantity": t, "unitPriceMicros": micros(r),
                    "amountCents": cents(r * Decimal(t) / Decimal(1_000_000)),
                } for m, d, t, r in BILLED],
            }],
            "usageTotals": [
                {"meter": f"{m} {d}", "periodStart": "2026-10-01", "periodEnd": "2026-10-31", "quantity": q}
                for (m, d), q in LOGGED.items()
            ],
        },
    ],
    "rulesForAfterScenario": [
        {"vendorId": "v_cobalt", "type": "override_term",
         "payload": {"key": "seat_cap", "value": 48, "effectiveFrom": "2026-04-01"},
         "reason": "We approved 48 seats by email on 28 March 2026."}
    ],
}
(Path(__file__).parent / "sample-structured.json").write_text(json.dumps(structured, indent=2))

# ---------------------------------------------------------------- pre-extracted document text
import subprocess

docs = []
for p in sorted(OUT.iterdir()):
    if p.suffix == ".pdf":
        text = subprocess.run(["pdftotext", "-layout", str(p), "-"], capture_output=True, text=True).stdout
    else:
        text = p.read_text()
    vendor = "Cobalt Workspace" if p.name.startswith("cobalt") else "Halcyon AI"
    kind = ("contract" if "order-form" in p.name else
            "usage_export" if p.suffix == ".csv" else "invoice")
    docs.append({"vendor": vendor, "kind": kind, "name": p.name, "text": text.rstrip() + "\n"})
(Path(__file__).parent / "sample-documents.json").write_text(json.dumps(docs, indent=2))

for k in ("beforeRule", "afterRule_seatCap48FromApril2026"):
    r = result[k]
    print(k, "total $", r["recoverableCents"] / 100, r["byCheckCents"])
print("at risk $", result["beforeRule"]["deadline"]["atRiskCents"] / 100)
print("files:", len(list(OUT.iterdir())))
