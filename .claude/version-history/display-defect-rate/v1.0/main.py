"""스마트폰 디스플레이 생산 라인 — 설비/모델별 불량율 집계."""

import csv
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = BASE_DIR / "data" / "production.csv"
DEFAULT_OUTPUT = BASE_DIR / "data" / "report.csv"


def load_rows(input_path):
    with open(input_path, newline="", encoding="utf-8") as fp:
        reader = csv.DictReader(fp)
        return [
            {
                "facility_id": row["facility_id"],
                "model_id": row["model_id"],
                "produced_qty": int(row["produced_qty"]),
                "defect_qty": int(row["defect_qty"]),
            }
            for row in reader
        ]


def aggregate(rows, key):
    totals = {}
    for row in rows:
        bucket = totals.setdefault(row[key], {"produced_qty": 0, "defect_qty": 0})
        bucket["produced_qty"] += row["produced_qty"]
        bucket["defect_qty"] += row["defect_qty"]
    return {
        name: {
            **counts,
            "defect_rate": counts["defect_qty"] / counts["produced_qty"] if counts["produced_qty"] else 0.0,
        }
        for name, counts in totals.items()
    }


def print_table(title, aggregated):
    print(f"\n== {title} ==")
    print(f"{'ID':<10}{'생산량':>10}{'불량수':>10}{'불량율':>10}")
    for name in sorted(aggregated):
        counts = aggregated[name]
        print(f"{name:<10}{counts['produced_qty']:>10}{counts['defect_qty']:>10}{counts['defect_rate']:>9.2%}")


def write_report(output_path, by_facility, by_model):
    with open(output_path, "w", newline="", encoding="utf-8") as fp:
        writer = csv.writer(fp)
        writer.writerow(["scope", "id", "produced_qty", "defect_qty", "defect_rate"])
        for name in sorted(by_facility):
            c = by_facility[name]
            writer.writerow(["facility", name, c["produced_qty"], c["defect_qty"], f"{c['defect_rate']:.4f}"])
        for name in sorted(by_model):
            c = by_model[name]
            writer.writerow(["model", name, c["produced_qty"], c["defect_qty"], f"{c['defect_rate']:.4f}"])


def main(argv):
    input_path = Path(argv[1]) if len(argv) > 1 else DEFAULT_INPUT
    output_path = Path(argv[2]) if len(argv) > 2 else DEFAULT_OUTPUT

    rows = load_rows(input_path)
    by_facility = aggregate(rows, "facility_id")
    by_model = aggregate(rows, "model_id")

    print_table("설비별 불량율", by_facility)
    print_table("모델별 불량율", by_model)

    write_report(output_path, by_facility, by_model)
    print(f"\n리포트 저장: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
