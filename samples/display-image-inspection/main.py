"""스마트폰 디스플레이 검사 이미지 — 불량(얼룩) 위치 분석.

외부 이미지 라이브러리 없이 순수 표준 라이브러리로 PGM(P2, ASCII 그레이스케일)
형식을 직접 읽는다. 실제 검사 장비가 내보내는 이미지 포맷이 다르면 `load_pgm`만
그 포맷에 맞게 교체하면 된다.
"""

import csv
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_IMAGE_DIR = BASE_DIR / "images"
DEFAULT_OUTPUT = BASE_DIR / "images" / "defect_report.csv"

# 배경 대비 이 값 이상 차이나는 픽셀을 불량 후보로 본다.
DEVIATION_THRESHOLD = 25
# 불량 후보 픽셀 군집이 이 개수 미만이면 노이즈로 보고 무시한다.
MIN_CLUSTER_SIZE = 4


def load_pgm(path):
    with open(path, "r", encoding="ascii") as fp:
        tokens = fp.read().split()
    if tokens[0] != "P2":
        raise ValueError(f"{path}: PGM(P2) 형식이 아닙니다")
    width, height, maxval = int(tokens[1]), int(tokens[2]), int(tokens[3])
    values = list(map(int, tokens[4:4 + width * height]))
    pixels = [values[y * width:(y + 1) * width] for y in range(height)]
    return width, height, pixels


def estimate_background(pixels):
    all_values = sorted(v for row in pixels for v in row)
    mid = len(all_values) // 2
    return all_values[mid]


def find_defect_clusters(width, height, pixels, background):
    visited = [[False] * width for _ in range(height)]
    is_anomalous = lambda x, y: abs(pixels[y][x] - background) >= DEVIATION_THRESHOLD

    clusters = []
    for y in range(height):
        for x in range(width):
            if visited[y][x] or not is_anomalous(x, y):
                continue
            # BFS flood-fill to collect one connected anomalous region.
            stack = [(x, y)]
            visited[y][x] = True
            region = []
            while stack:
                cx, cy = stack.pop()
                region.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < width and 0 <= ny < height and not visited[ny][nx] and is_anomalous(nx, ny):
                        visited[ny][nx] = True
                        stack.append((nx, ny))
            if len(region) >= MIN_CLUSTER_SIZE:
                xs = [p[0] for p in region]
                ys = [p[1] for p in region]
                clusters.append({
                    "x_min": min(xs), "x_max": max(xs),
                    "y_min": min(ys), "y_max": max(ys),
                    "size": len(region),
                })
    return clusters


def analyze_image(path):
    width, height, pixels = load_pgm(path)
    background = estimate_background(pixels)
    clusters = find_defect_clusters(width, height, pixels, background)
    return clusters


def main(argv):
    image_dir = Path(argv[1]) if len(argv) > 1 else DEFAULT_IMAGE_DIR
    output_path = Path(argv[2]) if len(argv) > 2 else DEFAULT_OUTPUT

    image_paths = sorted(image_dir.glob("*.pgm"))
    if not image_paths:
        print(f"경고: {image_dir}에 .pgm 이미지가 없습니다")
        return 1

    report_rows = []
    defect_sizes = []
    for path in image_paths:
        clusters = analyze_image(path)
        if not clusters:
            print(f"{path.name}: 불량 없음")
            report_rows.append([path.name, 0, "", "", "", "", ""])
            continue
        for cluster in clusters:
            cx = (cluster["x_min"] + cluster["x_max"]) // 2
            cy = (cluster["y_min"] + cluster["y_max"]) // 2
            print(f"{path.name}: 불량 위치 (x={cx}, y={cy}), 크기={cluster['size']}px")
            defect_sizes.append(cluster["size"])
            report_rows.append([
                path.name, 1, cx, cy,
                cluster["x_min"], cluster["y_min"],
                f"{cluster['x_max'] - cluster['x_min'] + 1}x{cluster['y_max'] - cluster['y_min'] + 1}",
            ])

    with open(output_path, "w", newline="", encoding="utf-8") as fp:
        writer = csv.writer(fp)
        writer.writerow(["file", "has_defect", "center_x", "center_y", "bbox_x", "bbox_y", "bbox_size"])
        writer.writerows(report_rows)

    if defect_sizes:
        avg_size = sum(defect_sizes) / len(defect_sizes)
        print(f"\n불량 {len(defect_sizes)}건 평균 크기: {avg_size:.1f}px")
    print(f"리포트 저장: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
