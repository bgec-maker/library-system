import type { HomeroomReport, NoLoanFinderReport } from '../services/reportData';

// 「샘플 데이터」 폴백 — mocks/dashboard.ts와 같은 규약(todo/04). Code.gs가 아직 report 액션을
// 모르는 배포(UNKNOWN_ACTION)일 때 services/reportData.ts가 이 객체들을 대신 내려주고, 화면은
// components/SampleDataBadge.tsx로 "이건 진짜 데이터가 아니다"를 알린다.
//
// 여기 담긴 학생 이름·책 제목은 UI 카피가 아니라 데이터(진짜 배포에서 시트가 채울 값과 같은 자리)
// 이므로 ADR-023 i18n 리터럴 금지 대상이 아니다 — mocks/는 애초에 그 린트가 보는
// views/**·shells/**·student/** 밖이다.
export const mockNoLoanFinderReport: NoLoanFinderReport = {
  libraryName: 'BGEC 도서관 (샘플)',
  generatedAt: '2026-07-15 09:00',
  sinceDate: '2026-04-15',
  totalCount: 7,
  classes: [
    {
      grade: 1,
      classNo: 2,
      students: [
        { memberNo: '10203', name: '박지호', studentNo: 3 },
        { memberNo: '10207', name: '이수민', studentNo: 7 }
      ]
    },
    {
      grade: 2,
      classNo: 1,
      students: [
        { memberNo: '20101', name: '김도윤', studentNo: 1 },
        { memberNo: '20112', name: '최하은', studentNo: 12 },
        { memberNo: '20119', name: '정민준', studentNo: 19 }
      ]
    },
    {
      grade: 3,
      classNo: 4,
      students: [
        { memberNo: '30405', name: '오서연', studentNo: 5 },
        { memberNo: '30409', name: '한지우', studentNo: 9 }
      ]
    }
  ]
};

export const mockHomeroomReport: HomeroomReport = {
  libraryName: 'BGEC 도서관 (샘플)',
  generatedAt: '2026-07-15 09:00',
  grade: 2,
  classNo: 1,
  month: '2026-07',
  studentCount: 5,
  loanStatus: [
    { memberNo: '20101', name: '김도윤', studentNo: 1, loanCount: 2 },
    { memberNo: '20105', name: '서지안', studentNo: 5, loanCount: 0 },
    { memberNo: '20112', name: '최하은', studentNo: 12, loanCount: 1 },
    { memberNo: '20115', name: '강태오', studentNo: 15, loanCount: 3 },
    { memberNo: '20119', name: '정민준', studentNo: 19, loanCount: 0 }
  ],
  noLoanList: [
    { memberNo: '20105', name: '서지안', studentNo: 5, loanCount: 0 },
    { memberNo: '20119', name: '정민준', studentNo: 19, loanCount: 0 }
  ],
  overdueList: [{ memberNo: '20112', name: '최하은', title: '완득이', dueAtText: '2026-07-08', overdueDays: 7 }],
  popularBooks: [
    { title: '아몬드', loanCount: 3 },
    { title: '어린 왕자', loanCount: 2 },
    { title: '해리 포터와 마법사의 돌', loanCount: 1 }
  ]
};
