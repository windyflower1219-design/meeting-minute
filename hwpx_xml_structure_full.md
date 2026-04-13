# hwpx_xml_structure_full.md
# HWPX 직접 생성용 XML 구조 상세 명세서

## 1. 목적
이 문서는 Python으로 HWPX를 직접 생성하기 위한 최소/확장 구조를 정의한다.
MVP에서는 최소 호환 구조를 목표로 하고, 이후 표/스타일/레이아웃을 단계적으로 확장한다.

---

## 2. HWPX 개념

HWPX는 ZIP 패키지 내부에 XML 문서와 리소스를 포함하는 구조로 다룬다.
직접 생성기는 아래 과정을 따른다.

```text
Document DTO
→ XML 파일 생성
→ ZIP 패키징
→ .hwpx 출력
```

---

## 3. MVP 파일 구조

```text
minutes.hwpx
├─ mimetype
├─ META-INF/
│  └─ container.xml
├─ Contents/
│  ├─ content.hpf
│  ├─ header.xml
│  └─ section0.xml
└─ Preview/
   └─ PrvText.txt
```

---

## 4. 파일별 역할

## 4.1 mimetype
패키지 MIME 식별용 텍스트 파일

예시:
```text
application/hwp+zip
```

주의:
- 압축 패키지 내부 루트에 위치
- 가능하면 첫 엔트리로 넣는 것을 권장

---

## 4.2 META-INF/container.xml
루트 문서 위치를 가리킨다.

예시:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="Contents/content.hpf" media-type="application/xml"/>
  </rootfiles>
</container>
```

설명:
- `full-path`는 메인 패키지 정의 파일을 가리킨다.

---

## 4.3 Contents/content.hpf
문서 패키지의 본체 메타 정의

MVP 예시:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<hpf version="1.0" xmlns="http://www.hancom.co.kr/hwpml/2016/format">
  <head>
    <metadata>
      <title>Meeting Minutes</title>
    </metadata>
  </head>
  <body>
    <section href="section0.xml"/>
  </body>
</hpf>
```

필드 설명:
- `metadata/title`: 문서 제목
- `body/section`: 문서 본문 section 파일 참조

---

## 4.4 Contents/header.xml
문서 헤더/기본 정보

MVP 예시:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<header xmlns="http://www.hancom.co.kr/hwpml/2016/format">
  <title>자동 생성 회의록</title>
</header>
```

확장 포인트:
- 작성자
- 생성일시
- 문서 속성
- 문서 버전

---

## 4.5 Contents/section0.xml
실제 본문이 들어가는 파일

MVP는 paragraph 중심으로 생성한다.

기본 예시:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<section xmlns="http://www.hancom.co.kr/hwpml/2016/format">
  <p><run><t>자동 생성 회의록</t></run></p>
  <p><run><t>회의 개요</t></run></p>
  <p><run><t>일자: 2026-04-09</t></run></p>
  <p><run><t>참석자: 홍길동, 김철수</t></run></p>
</section>
```

---

## 4.6 Preview/PrvText.txt
문서 미리보기용 텍스트

예시:
```text
자동 생성 회의록

[Action Item]
1. Edge 요구조건 정리 / 담당: 연구소장
2. DQ 인증 조사 / 담당: AI전략기획팀
```

---

## 5. section0.xml 세부 설계

## 5.1 paragraph 기본 구조
MVP paragraph는 아래 템플릿 사용

```xml
<p>
  <run>
    <t>문단 텍스트</t>
  </run>
</p>
```

### 매핑 함수
```python
def _paragraph(text: str) -> str:
    return f'<p><run><t>{escape(text)}</t></run></p>'
```

### 주의
- XML escape 필수
- 특수문자 `& < >` 처리

---

## 5.2 heading 표현
MVP에서는 heading 전용 태그를 쓰지 않고 paragraph 텍스트로 처리한다.
예:
- `회의 개요`
- `Action Item`
- `회의 내용`

고도화 버전에서는 style id 또는 별도 속성 부여를 고려한다.

---

## 5.3 Action Item 표현
MVP에서는 표 대신 문단 나열로 처리한다.

예시:
```xml
<p><run><t>Action Item</t></run></p>
<p><run><t>1. Edge 요구사항 정리 / 담당: 연구소장 / 기한: -</t></run></p>
<p><run><t>   다음 주까지 정리해서 공유 필요</t></run></p>
```

### 이유
- 최소 구조 호환성 우선
- 표 XML은 고도화 단계에서 도입

---

## 5.4 Body Section 표현
안건별 본문은 heading + bullet-like paragraph로 구성

예시:
```xml
<p><run><t>연구 결과</t></run></p>
<p><run><t>- 접근로 및 진출선 분석 기능 개발 완료</t></run></p>
<p><run><t>- 관측 우세 지역 도출 기능 추가</t></run></p>
```

---

## 6. Document DTO → XML 매핑 규칙

## 6.1 Document DTO 예시
```json
{
  "title": "자동 생성 회의록",
  "meeting_date_text": "2026-04-09",
  "attendees": ["박준형", "김기영"],
  "action_items": [
    {
      "title": "Edge 요구사항 정리",
      "detail": "차주까지 정리해서 공유",
      "owner_name": "연구소장",
      "due_date": null
    }
  ],
  "body_sections": [
    {
      "title": "연구 결과",
      "paragraphs": [
        "접근로 및 진출선 분석 기능 개발 완료"
      ]
    }
  ]
}
```

## 6.2 매핑 순서
1. title
2. 빈 줄
3. 회의 개요
4. meeting_date_text
5. attendees
6. 빈 줄
7. Action Item heading
8. 각 action item 2문단
9. 빈 줄
10. 회의 내용 heading
11. body_sections 반복

---

## 7. 표 구조 확장 설계

HWPX 고도화 시 Action Item을 표로 전환한다.

목표 표:
- No
- 요구 내용
- 담당
- 기한

확장 설계 방식:
1. 내부 document model에 table block 추가
2. renderer에서 table XML 생성기 추가
3. 호환성 확인 전까지 feature flag로 비활성 가능

권장 인터페이스:
```python
class TableBlock(BaseModel):
    columns: list[str]
    rows: list[list[str]]
```

---

## 8. 스타일 구조 확장 설계

## 8.1 현재 상태
- 모든 문단 동일 스타일

## 8.2 확장 목표
- Title
- Heading1
- Body
- TableHeader
- TableCell

## 8.3 내부 모델 예시
```python
class ParagraphBlock(BaseModel):
    text: str
    style: Literal["title", "heading1", "body"]
```

## 8.4 렌더링 규칙
- style별 XML 속성/ID 주입
- 미지원 시 기본 paragraph fallback

---

## 9. 페이지 레이아웃 확장 설계

고도화 시 추가할 항목:
- A4 세로
- 기본 여백
- 기본 글꼴
- 줄간격
- 문단 간격
- 표 너비

권장 방식:
- `layout.xml` 또는 header 확장
- 버전별 실험 후 템플릿화

---

## 10. Python 구현 지침

## 10.1 렌더러 클래스 시그니처
```python
class HwpxRenderer:
    def render(self, dto: MeetingMinutesDTO, output_path: str) -> str:
        ...
```

## 10.2 내부 단계
```python
def render(...):
    1. output path 생성
    2. xml 문자열 생성
    3. zip write
    4. output_path 반환
```

## 10.3 필수 보조 함수
```python
def _preview_text(self, dto): ...
def _container_xml(self): ...
def _manifest_xml(self): ...
def _header_xml(self, title): ...
def _paragraph(self, text): ...
def _section_xml(self, dto): ...
```

---

## 11. 에러 처리

### 렌더링 단계 에러
- DTO 비어 있음
- output path 생성 실패
- zip write 실패
- encoding 실패

### 권장 예외
```python
class ExportError(Exception): ...
```

### 정책
- 실패 시 intermediate JSON은 반드시 저장
- HWPX 실패여도 JSON은 복구 가능하게 유지

---

## 12. 호환성 검증 체크리스트

실서비스 투입 전 아래를 확인한다.
1. 한글에서 파일 열기 성공
2. 제목, 본문, 줄바꿈 정상
3. 한글/영문/특수문자 깨짐 없음
4. Preview 텍스트 표시 정상
5. 3페이지 이상 문서도 열림
6. 긴 Action Item이 잘리지 않음

---

## 13. 샘플 XML 조합

### section0.xml 샘플
```xml
<?xml version="1.0" encoding="UTF-8"?>
<section xmlns="http://www.hancom.co.kr/hwpml/2016/format">
  <p><run><t>자동 생성 회의록</t></run></p>
  <p><run><t></t></run></p>
  <p><run><t>회의 개요</t></run></p>
  <p><run><t>일자: 2026-04-09</t></run></p>
  <p><run><t>참석자: 박준형, 김기영</t></run></p>
  <p><run><t></t></run></p>
  <p><run><t>Action Item</t></run></p>
  <p><run><t>1. Edge 요구사항 정리 / 담당: 연구소장 / 기한: -</t></run></p>
  <p><run><t>   차주까지 정리해서 공유</t></run></p>
  <p><run><t></t></run></p>
  <p><run><t>회의 내용</t></run></p>
  <p><run><t>연구 결과</t></run></p>
  <p><run><t>- 접근로 및 진출선 분석 기능 개발 완료</t></run></p>
</section>
```

---

## 14. 고도화 로드맵

### Phase 1
- paragraph only HWPX
- 실제 파일 열림 확인

### Phase 2
- style block 도입
- table block 도입

### Phase 3
- 레이아웃/글꼴/여백 정밀 제어
- 템플릿 기반 문서 렌더링

### Phase 4
- 이미지/도표/첨부 리소스 포함

---

## 15. 결론

HWPX 직접 생성은 바로 가능하지만, 처음부터 표/스타일/레이아웃까지 모두 구현하면 불안정해진다.
따라서 MVP는
- paragraph 중심 최소 패키지 생성
- 실제 한글 호환성 검증
- 이후 표와 스타일 확장

순서로 가는 것이 가장 안전하다.