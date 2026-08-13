# display-image-inspection

## 용도
스마트폰 디스플레이 검사 장비가 찍은 이미지에서 불량(얼룩·스크래치 등 배경과 밝기가 크게 다른 부분)의 위치를 찾는다. 이미지 10장을 한 번에 훑어 어느 이미지에 불량이 있는지, 화면 좌표 어디인지를 보고한다.

## 입출력
- 입력: `images/*.pgm` — PGM(P2, ASCII 그레이스케일) 형식 검사 이미지. 실제 검사 장비 출력 포맷이 다르면 `src/main.py`의 `load_pgm` 함수만 그 포맷에 맞게 바꾸면 된다.
- 출력: 콘솔에 이미지별 불량 유무·위치와 전체 평균 불량 크기(px)를 출력하고, `images/defect_report.csv`에 `file, has_defect, center_x, center_y, bbox_x, bbox_y, bbox_size` 열로 저장한다.

## 실행 방법
```
python samples/display-image-inspection/src/main.py
```
이미지 폴더·출력 경로를 바꾸려면:
```
python samples/display-image-inspection/src/main.py <이미지폴더> <출력.csv>
```

## 수정 시 참고
- `src/main.py` — `load_pgm`(이미지 읽기) → `estimate_background`(정상 밝기값 추정) → `find_defect_clusters`(배경과 크게 다른 픽셀을 flood-fill로 묶어 하나의 불량으로 판정) → 리포트 출력 순서.
- `DEVIATION_THRESHOLD`, `MIN_CLUSTER_SIZE` (파일 상단 상수) — 민감도 조절. 오탐이 많으면 올리고, 작은 불량을 놓치면 내린다.
- `images/*.pgm` — 샘플 검사 이미지. 실제 이미지로 교체 시 PGM(P2) 포맷 변환이 먼저 필요하다.
