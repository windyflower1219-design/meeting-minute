# meeting_minutes_code_level_spec.md
# AI 회의록 생성 시스템 - 코드 레벨 설계 명세서

## 1. 목적
이 문서는 개발자가 바로 구현에 착수할 수 있도록 클래스, 함수, 입출력, 예외 처리, 테스트 포인트까지 코드 단위로 정의한다.

---

## 2. 패키지 구조

```text
app/
  main.py
  api/
    routes_meetings.py
    routes_jobs.py
  core/
    config.py
    database.py
    logging.py
    exceptions.py
  models/
    db_models.py
    schemas.py
    document_model.py
  services/
    parsing/
      transcript_parser.py
      ppt_parser.py
    processing/
      cleaner.py
      segmenter.py
      agenda_builder.py
      aligner.py
      importance.py
      action_item_engine.py
      composer.py
      validator.py
    llm/
      base.py
      stub_client.py
      openai_client.py
    export/
      hwpx_renderer.py
      hwpx_template.py
  tasks/
    celery_app.py
    generate_minutes_task.py
tests/
```

---

## 3. 핵심 데이터 모델

### 3.1 ParsedUtterance
```python
@dataclass
class ParsedUtterance:
    speaker: str | None
    timestamp: str | None
    text: str
```

### 3.2 ParsedSlide
```python
@dataclass
class ParsedSlide:
    title: str
    bullets: list[str]
```

### 3.3 Segment
```python
@dataclass
class Segment:
    order_index: int
    text: str
    utterance_indexes: list[int]
```

### 3.4 ActionCandidate
```python
@dataclass
class ActionCandidate:
    title: str
    detail: str
    owner_name: str | None
    due_date: date | None
    confidence: float
    source_segment_ids: list[int]
```

### 3.5 MeetingMinutesDTO
```python
class MeetingMinutesDTO(BaseModel):
    title: str
    meeting_date_text: str
    location: str | None = None
    attendees: list[str] = []
    action_items: list[ActionItemDTO] = []
    body_sections: list[dict] = []
```

---

## 4. 모듈별 상세 설계

## 4.1 TranscriptParser

### 역할
- TXT 녹취록을 읽어서 화자/시각/본문으로 분리한다.

### 입력
- `text: str`

### 출력
- `list[ParsedUtterance]`

### 공개 메서드
```python
class TranscriptParser:
    def parse(self, text: str) -> list[ParsedUtterance]:
        ...
```

### 처리 로직
1. 줄 단위 분해
2. 화자+시각 헤더 패턴 탐지
3. 다음 헤더 전까지 본문 버퍼링
4. 비어 있는 발언 제거

### 지원 패턴
- `홍길동 00:00`
- `홍길동 팀장 12:34`

### 예외 처리
- 패턴 불일치 시 `speaker=None`, `timestamp=None` fallback 허용
- 전체 파싱 실패 시 raw text 1개 utterance로 반환

### 테스트 포인트
- 일반 패턴 2건
- 화자 없는 텍스트
- 공백 라인 다수
- 긴 발언

---

## 4.2 PptParser

### 역할
- PPTX에서 슬라이드 제목과 bullet 텍스트를 추출한다.

### 입력
- `file_path: str`

### 출력
- `list[ParsedSlide]`

### 공개 메서드
```python
class PptParser:
    def parse(self, file_path: str) -> list[ParsedSlide]:
        ...
```

### 처리 로직
1. Presentation 로드
2. title shape 추출
3. title 외 shape text 수집
4. 라인 단위 bullet 정리

### 예외 처리
- 손상 파일: 예외 raise
- title 없는 슬라이드: `Untitled`

### 테스트 포인트
- title 있는 슬라이드
- title 없는 슬라이드
- 여러 text box
- 빈 슬라이드

---

## 4.3 TextCleaner

### 역할
- 과도한 공백 제거
- 최소 수준 정규화

### 공개 메서드
```python
class TextCleaner:
    def clean(self, text: str) -> str:
        ...
```

### 주의
- 의미 손실이 큰 filler 제거는 기본 비활성
- MVP에서는 공백 정규화 중심

---

## 4.4 Segmenter

### 역할
- 긴 녹취록을 LLM 처리 가능한 세그먼트로 분할한다.

### 생성자
```python
Segmenter(max_chars: int = 1800)
```

### 공개 메서드
```python
def segment(self, utterances: list[ParsedUtterance]) -> list[Segment]:
    ...
```

### 분할 기준
1. 최대 길이 초과 직전 분리
2. 이후 개선 버전에서는 화자 전환, 키워드 전환 반영

### 테스트 포인트
- 짧은 입력 1세그먼트
- 긴 입력 다중 세그먼트
- 경계값 테스트

---

## 4.5 AgendaBuilder

### 역할
- PPT 슬라이드 목록에서 agenda title list 생성

### 공개 메서드
```python
class AgendaBuilder:
    def build(self, slides: list[ParsedSlide]) -> list[str]:
        ...
```

### 규칙
- 중복 제목 제거
- 빈 제목 제외

---

## 4.6 AgendaAligner

### 역할
- 각 세그먼트를 agenda 항목과 정렬한다.

### 공개 메서드
```python
class AgendaAligner:
    def align(self, segments: list[Segment], agenda_titles: list[str]) -> list[tuple[Segment, str | None]]:
        ...
```

### MVP 로직
- title 문자열 포함 여부
- 미매칭 시 `None`

### 고도화 포인트
- 임베딩 기반 유사도
- 슬라이드 순서 prior
- 키워드 가중치

---

## 4.7 ImportanceScorer

### 역할
- 발언 중요도 계산

### 공개 메서드
```python
class ImportanceScorer:
    def score(self, text: str) -> int:
        ...
```

### 가중치
- 대표/연구소장 언급 +3
- 기한 표현 +2
- 지시/보고/확인 표현 +2

### 반환값
- 정수 점수

---

## 4.8 ActionItemEngine

### 역할
- 세그먼트에서 Action Item 후보를 추출하고 병합한다.

### 공개 메서드
```python
class ActionItemEngine:
    def extract_from_segments(self, segments: list[dict]) -> list[ActionCandidate]:
        ...
    def merge_candidates(self, candidates: list[ActionCandidate]) -> list[ActionCandidate]:
        ...
```

### 내부 메서드
```python
def _infer_owner(self, text: str) -> str | None
def _infer_title(self, text: str) -> str
def _infer_due_date(self, text: str) -> date | None
def _compact_text(self, text: str) -> str
def _similar(self, a: str, b: str) -> bool
```

### 상세 로직
1. Trigger phrase 존재 여부 확인
2. owner hint 탐색
3. title 규칙 기반 요약
4. due date 추론
5. confidence 계산
6. 유사 task 병합

### Trigger 예시
- 해야
- 확인
- 보고
- 정리
- 공유
- 검토
- 조사

### Owner hint 예시
- 연구소장
- AI전략기획팀
- 솔루션개발팀
- 디지털트윈팀
- 특정 인명

### 병합 규칙
- title token Jaccard similarity >= 0.35

### 테스트 포인트
- 단일 action 추출
- owner 있는 경우
- 유사 task 병합
- trigger 없는 segment

---

## 4.9 MinutesComposer

### 역할
- Action Item과 안건별 세그먼트를 최종 회의록 DTO로 조합한다.

### 공개 메서드
```python
class MinutesComposer:
    def compose(
        self,
        title: str,
        attendees: list[str],
        action_items: list[ActionItemDTO],
        aligned_segments: list[dict],
    ) -> MeetingMinutesDTO:
        ...
```

### 조합 규칙
- agenda_title 기준으로 body_sections 그룹핑
- 각 섹션은 상위 5개 paragraph만 우선 포함
- attendees dedup

---

## 4.10 Validator

### 역할
- 생성 결과 품질 검사

### 공개 메서드
```python
class Validator:
    def validate(self, dto: MeetingMinutesDTO) -> list[dict]:
        ...
```

### MVP 검사 항목
- Action Item 비어 있음
- owner_name 누락
- 후속으로 추가:
  - deadline 누락
  - 대표 발언 미반영
  - 중복 task

---

## 4.11 HwpxRenderer

### 역할
- Document DTO를 HWPX 패키지로 렌더링

### 공개 메서드
```python
class HwpxRenderer:
    def render(self, dto: MeetingMinutesDTO, output_path: str) -> str:
        ...
```

### 내부 메서드
```python
def _preview_text(self, dto: MeetingMinutesDTO) -> str
def _container_xml(self) -> str
def _manifest_xml(self) -> str
def _header_xml(self, title: str) -> str
def _paragraph(self, text: str) -> str
def _section_xml(self, dto: MeetingMinutesDTO) -> str
```

### 생성 파일
- `mimetype`
- `META-INF/container.xml`
- `Contents/content.hpf`
- `Contents/header.xml`
- `Contents/section0.xml`
- `Preview/PrvText.txt`

### 주의
- MVP는 최소 구조
- 실서비스 전 실제 한글 호환성 검증 필수

---

## 4.12 Celery Task

### 역할
- 업로드 후 비동기 전체 파이프라인 실행

### 태스크 함수
```python
@celery.task(name="generate_minutes")
def generate_minutes(job_id: str, meeting_id: str, transcript_path: str, slides_path: str):
    ...
```

### 처리 순서
1. 파일 로드
2. TXT 파싱
3. PPT 파싱
4. speaker 저장
5. segment 생성
6. agenda 정렬
7. action item 추출
8. dto compose
9. validation
10. hwpx 렌더
11. DB 상태 업데이트

### 실패 처리
- meeting.status = failed
- job status 파일 기록
- 예외 재전파

---

## 5. API 함수 설계

## 5.1 POST /api/v1/meetings/generate

### 입력
- transcript_file
- slides_file

### 동작
- 파일 저장
- meeting row 생성
- job enqueue
- meeting_id, job_id 반환

### 에러
- txt 아님 → 400
- pptx/ppt 아님 → 400

---

## 5.2 GET /api/v1/jobs/{job_id}

### 동작
- storage/jobs/{job_id}.json 읽어 상태 반환

### 반환
```json
{
  "job_id": "...",
  "status": "processing",
  "progress": 60,
  "current_step": "action_item_engine",
  "meeting_id": "..."
}
```

---

## 5.3 GET /api/v1/meetings/{meeting_id}/download

### query
- format=hwpx|json

### 동작
- output_path 조회
- 파일 응답

---

## 6. 예외 클래스 제안

```python
class ParsingError(Exception): ...
class ExportError(Exception): ...
class ValidationError(Exception): ...
class UnsupportedFormatError(Exception): ...
```

사용 권장 위치:
- parser
- renderer
- API input validation

---

## 7. 로깅 설계

### 필수 로그 항목
- job_id
- meeting_id
- step_name
- elapsed_ms
- input_count
- output_count
- error_message

### 예시
```text
[generate_minutes] meeting=abc step=parse_transcript utterances=312 elapsed=152ms
```

---

## 8. 테스트 설계

## 8.1 Unit Test
- transcript_parser
- ppt_parser
- segmenter
- action_item_engine
- hwpx_renderer

## 8.2 Integration Test
- txt+pptx → dto
- dto → hwpx

## 8.3 Golden Test
- 실제 회의 1건을 기준값으로 저장
- action item title/owner 일부 일치 확인

---

## 9. 리팩터링 우선순위

### 우선 구현
1. parser
2. segmenter
3. action_item_engine
4. composer
5. hwpx_renderer

### 다음 단계
1. llm client
2. embedding aligner
3. date parser
4. richer validation
5. template engine

---

## 10. 개발자 작업 순서

### 백엔드
- DB 세팅
- API 라우트
- 파일 저장 로직
- Celery 연결

### AI/문서 처리
- parser
- segmenter
- aligner
- action item engine
- composer

### 출력
- hwpx renderer
- 실제 샘플 문서 호환성 테스트

---

## 11. 완료 정의

다음이 만족되면 1차 완료로 간주한다.
1. TXT/PPTX 업로드 가능
2. job 상태 조회 가능
3. HWPX 파일 1건 생성 가능
4. Action Item 최소 1건 이상 추출 가능
5. 실패 시 status=failed 기록