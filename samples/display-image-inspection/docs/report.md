# display-image-inspection — 코드 분석

## 구현 개요
검사 이미지 한 장을 처리하는 과정을 세 단계로 쪼갰다: PGM 텍스트를 픽셀 2차원 배열로 바꾸는 `load_pgm`, 그 이미지의 "정상 밝기"가 얼마인지 추정하는 `estimate_background`, 정상 밝기와 크게 다른 픽셀들을 하나의 불량으로 묶는 `find_defect_clusters`. `analyze_image`가 이 셋을 순서대로 호출하고, `main`은 이미지 폴더를 훑으며 `analyze_image`를 반복 호출해 리포트를 쌓는다. 이렇게 나눈 이유는 세 단계가 서로 다른 이유로 바뀔 수 있어서다 — 이미지 포맷이 바뀌면 `load_pgm`만, 판정 기준이 바뀌면 `find_defect_clusters`만 손대면 되게 하려는 의도다(실제로 파일 최상단 주석에도 "다른 포맷이면 `load_pgm`만 교체하면 된다"고 적어뒀다).

## 핵심 로직 설명

불량 판정에서 가장 중요한 결정은 "정상 밝기를 어떻게 정할 것인가"다:

```python
def estimate_background(pixels):
    all_values = sorted(v for row in pixels for v in row)
    mid = len(all_values) // 2
    return all_values[mid]
```

평균이 아니라 **중앙값**을 썼다. 디스플레이 검사 이미지는 정상 영역이 화면 대부분을 차지하고 불량은 일부 픽셀에만 있으므로, 불량 픽셀 몇 개가 평균을 끌어당기는 걸 피하려면 중앙값이 이상치에 훨씬 강하다. 이미지 전체가 거의 균일한 배경이라는 전제가 있어서 가능한 단순화이고, 배경 자체가 불균일한 이미지(예: 화면에 원래 무늬가 있는 경우)에는 안 맞는다.

군집화는 4방향 flood-fill이다:

```python
def find_defect_clusters(width, height, pixels, background):
    visited = [[False] * width for _ in range(height)]
    is_anomalous = lambda x, y: abs(pixels[y][x] - background) >= DEVIATION_THRESHOLD
    ...
    while stack:
        cx, cy = stack.pop()
        region.append((cx, cy))
        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
            if 0 <= nx < width and 0 <= ny < height and not visited[ny][nx] and is_anomalous(nx, ny):
                ...
```

배경과 `DEVIATION_THRESHOLD` 이상 차이나는 픽셀 하나를 찾으면, 거기서 상하좌우로 계속 뻗어가며 "붙어있는 이상 픽셀"을 전부 하나의 불량으로 묶는다. 재귀 대신 명시적 스택(`stack`)을 쓴 이유는 이미지가 커지면 파이썬 재귀 한도(기본 1000)에 걸릴 수 있어서다. `MIN_CLUSTER_SIZE` 미만인 군집을 버리는 건, 픽셀 노이즈 한두 개가 우연히 임계값을 넘는 걸 진짜 불량과 구분하기 위해서다 — 이 두 상수(`DEVIATION_THRESHOLD`, `MIN_CLUSTER_SIZE`)가 사실상 이 알고리즘의 유일한 튜닝 지점이다.

## 이번 버전에서 바뀐 점과 이유
- **v1 (C, 최초 구현)**: 이미지별로 불량 위치(좌표, 크기)를 찾아 CSV로 남기는 것까지가 요구사항이었다. PGM을 직접 파싱하기로 한 건 외부 이미지 라이브러리(Pillow 등)를 이 저장소에 새로 추가하고 싶지 않아서였다 — 검사 장비가 실제로 내보내는 포맷이 PGM이 아니더라도, 픽셀 값을 텍스트로 덤프할 수만 있으면 `load_pgm` 하나만 바꿔서 재사용할 수 있게 설계했다.
- **v2 (D, 이번 등록)**: 이미지별로 불량 크기가 나오긴 했지만 "이번 배치 전체적으로 불량이 커지는 추세인지"를 보려면 매번 CSV를 열어 계산해야 했다. `main`에서 `defect_sizes` 리스트에 크기를 모아뒀다가 마지막에 평균을 콘솔에 한 줄 찍도록 추가했다 — 별도 함수로 빼지 않은 이유는 이미 순회 중인 `report_rows` 루프에서 값을 얻을 수 있어, 굳이 이미지를 다시 훑는 함수를 만들 필요가 없었기 때문이다.

## 알려진 제약 · 다음에 볼 사람이 알아야 할 것
- `estimate_background`가 중앙값 기반이라, 불량 픽셀이 이미지의 절반 가까이를 차지하는 극단적인 경우엔 오히려 불량 쪽을 "배경"으로 오판할 수 있다. 지금 샘플 이미지들(불량이 화면의 일부에 그침)에서는 문제 없지만, 대형 얼룩 같은 케이스가 들어오면 이 가정을 다시 봐야 한다.
- `load_pgm`은 PGM 주석 줄(`#`으로 시작하는 줄)을 처리하지 않는다. 지금 샘플 이미지엔 주석이 없어서 문제가 안 됐을 뿐, 실제 검사 장비가 주석이 섞인 PGM을 내보낸다면 `tokens` 파싱이 깨진다.
