import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Support large payload for base64 PDF and images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Shared Gemini client setup
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Model list & active settings
app.get('/api/config', (req, res) => {
  res.json({
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    defaultModel: 'gemini-3.8-flash',
    supportedModels: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (기본 / 권장)' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
    ],
  });
});

// Document analysis endpoint using Gemini 3.8 Flash
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY가 설정되지 않았습니다. Secrets 패널에서 키를 확인해주세요.',
      });
    }

    const {
      files, // Array<{ fileName: string, mimeType: string, base64: string, docType?: string }>
      selectedModel = 'gemini-3.8-flash',
      reportDate = new Date().toISOString().slice(0, 10),
    } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: '분석할 파일이 제공되지 않았습니다.' });
    }

    const promptText = `
너는 대한민국 건설회사 인사팀의 전문 채용 서류 분석관이자 한국건설기술인협회(KOCEA) 건설기술인 경력증명서 판독 전문가다.
첨부된 문서(이력서 및/또는 한국건설기술인협회 경력증명서)를 철저히 정밀 분석하여 다음 규칙에 따라 JSON으로 구조화하라.

[핵심 정밀 판독 및 추출 규칙]
1. 성명 (nameKo):
   - 경력증명서가 있다면 반드시 경력증명서의 '한글 성명'만 기재.
   - 이력서만 있다면 이력서의 성명.
2. 생년월일 (birthDate, YYYY-MM-DD):
   - 경력증명서나 이력서에 기재된 생년월일을 정확히 추출.
   - 주민등록번호 뒷자리는 절대 추출/저장하지 말 것. 생년월일만 추출.
3. 최종학력 (education):
   - 경력증명서의 학력사항(또는 이력서)에서 학교명, 학과, 학위구분(전문학사 2년제/3년제, 학사, 석사, 박사)을 정확히 추출.
   - 전문대학의 경우 2년제인지 3년제(전문학사 3년제)인지 표기를 면밀히 확인.
4. 주소 (addressCityCountyDistrict):
   - 시·군·구까지만 추출 (예: "서울 성북구", "경기 안양시 만안구").
   - 상세 번지/동호수는 개인정보 보호를 위해 제외.
5. 자격사항 (qualifications):
   - 국가기술자격 '종목 및 등급'만 추출 (예: "건축기사", "건설안전기사").
   - 한국건설기술인협회의 기술인 등급(초급, 중급, 고급, 특급)은 국가기술자격이 아니므로 절대 자격사항에 넣지 말 것!
6. 연락처 (resumeContact):
   - 이력서의 휴대폰 번호. 선행 '0'을 유지하는 문자열 (예: "010-1234-5678").
7. 희망연봉 및 직전연봉:
   - desiredSalaryRaw: 이력서에 기재된 희망연봉 원문 그대로 (예: "5,000~6,000", "회사내규에 따름").
   - previousSalaryManwon: 이력서에 기재된 직전연봉 숫자(만원 단위, 예: 4500). 없으면 null.
8. 수기 메모 판독 (중요 - 인사담당자 수기):
   - 이력서 여백이나 표 상단/외곽에 인사담당자가 펜으로 쓴 수기 메모를 정밀 판독할 것.
   - interviewDateTimeRaw: 수기로 적힌 면접 일시 (예: "11/3(화) 14시", "11월 4일 오후 2시", "2026-11-03 14:00" 등).
   - handwrittenJobType: 수기로 적힌 직종 (예: "외주", "건축", "토목", "공무" 등).
   - handwrittenPlacement: 수기로 적힌 배치현장 (예: "본사", "서울현장", "경기현장" 등).
   - 예컨대 "본사(외주)"라고 적혀있으면 배치현장="본사", 직종="외주"로 분리.
   - 인쇄된 기본 양식 내용이나 지원분야를 수기 메모로 추정하여 날조하지 말 것. 수기가 없으면 빈 문자열("")로 표시.
9. 근무처 및 직위 (careerPeriods):
   - 경력증명서의 '근무처' 표를 기준으로 입사일 기준 내림차순(최근 근무처가 위)으로 추출.
   - 표가 여러 페이지로 이어지면 모든 페이지의 근무처를 빠짐없이 추출.
   - startDate: 입사일 (YYYY-MM-DD)
   - endDate: 퇴사일 (YYYY-MM-DD) 또는 재직 중이면 "근무중"
   - isCurrentlyEmployed: 현재 재직 중 여부 (boolean)
   - position (직위): 경력증명서 뒷부분의 '상세 기술경력' 표에서 해당 근무처의 퇴직일(또는 현재)을 포함하는 기간의 '직위'(예: 부장, 과장, 대리 등)를 찾아 기재. 퇴직일 해당 기록에 직위가 없으면 '미기재'.
   - '담당업무', '책임정도', '참여기술인', '현장대리인'을 직위와 혼동하지 말 것!
10. 불일치 및 확인 필요 사항 (issues):
    - 이력서와 경력증명서 간의 회사명/기간 차이, 판독 불확실한 수기 메모, 생년월일 불명 등 확인이 필요한 사항을 구체적인 사유와 함께 나열.
`;

    // Prepare contents
    const contents: any[] = [];
    contents.push({ text: promptText });

    for (const file of files) {
      contents.push({
        inlineData: {
          mimeType: file.mimeType || 'application/pdf',
          data: file.base64,
        },
      });
      contents.push({
        text: `위 파일은 '${file.fileName}' (${file.docType || '자동 판독'}) 입니다.`,
      });
    }

    const response = await ai.models.generateContent({
      model: selectedModel || 'gemini-3.8-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nameKo: { type: Type.STRING },
            birthDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  schoolName: { type: Type.STRING },
                  major: { type: Type.STRING },
                  degreeType: {
                    type: Type.STRING,
                    description: '고졸, 전문학사, 전문학사(3년제), 학사, 석사, 박사 등',
                  },
                  graduationDate: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                },
                required: ['schoolName', 'major'],
              },
            },
            addressCityCountyDistrict: {
              type: Type.STRING,
              description: '시군구만 (예: 서울 성북구, 경기 안양시 만안구)',
            },
            addressRaw: { type: Type.STRING },
            qualifications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: '국가기술자격 종목 및 등급' },
                  issueDate: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                },
                required: ['name'],
              },
            },
            resumeContact: {
              type: Type.STRING,
              description: '010으로 시작하는 선행 0 보존 휴대폰번호',
            },
            desiredSalaryRaw: { type: Type.STRING },
            previousSalaryManwon: { type: Type.INTEGER, nullable: true },
            handwrittenInterviewSchedule: {
              type: Type.OBJECT,
              properties: {
                rawText: { type: Type.STRING },
                parsedDate: { type: Type.STRING, description: 'YYYY-MM-DD 형식 (예측 가능시)' },
                parsedTime: { type: Type.STRING, description: 'HH:mm (24시간제, 예: 14:00)' },
                confidence: { type: Type.STRING, enum: ['high', 'medium', 'low', 'none'] },
                pageNumber: { type: Type.INTEGER },
              },
            },
            handwrittenJobType: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                pageNumber: { type: Type.INTEGER },
                notes: { type: Type.STRING },
              },
            },
            handwrittenPlacement: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                pageNumber: { type: Type.INTEGER },
                notes: { type: Type.STRING },
              },
            },
            careerPeriods: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  companyRaw: { type: Type.STRING },
                  startDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
                  endDate: { type: Type.STRING, description: 'YYYY-MM-DD 또는 "근무중"' },
                  isCurrentlyEmployed: { type: Type.BOOLEAN },
                  position: { type: Type.STRING, description: '상세경력 퇴직일 기준 직위 또는 미기재' },
                  positionEvidence: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                },
                required: ['companyRaw', 'startDate', 'endDate', 'position'],
              },
            },
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  field: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ['error', 'warning', 'info'] },
                  message: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                  needsReview: { type: Type.BOOLEAN },
                },
                required: ['field', 'severity', 'message'],
              },
            },
          },
          required: ['nameKo', 'careerPeriods'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      data: parsedData,
      rawText: response.text,
    });
  } catch (error: any) {
    console.error('Gemini analysis error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '문서 분석 중 오류가 발생했습니다.',
    });
  }
});

// Setup Vite middleware for local development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`채용_면접 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
