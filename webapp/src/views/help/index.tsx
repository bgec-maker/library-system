import { useCallback, useEffect, useState } from 'react';
import { HELP_KO } from '../../content/help.ko';
import { HELP_EN } from '../../content/help.en';
import { HELP_SECTION_IDS, type HelpContent } from '../../content/helpTypes';
import { fetchNotices, markNoticesSeen, type NoticeItem } from '../../services/noticeData';
import { t, useLocale } from '../../i18n';
import type { ViewProps } from '../../types';
import './help.css';

// 도움말 뷰 — todo/137(공지)·138(사용법 가이드). 사용자 요청: "공지 남길 곳 + 현재 기능
// 사용법, 시트가 아니라 앱에서". 공지는 23_NOTICES 시트가 원천(관리자가 행 추가 = 즉시
// 게시, services/noticeData.ts), 가이드는 번들 내장 콘텐츠(src/content/help.*.ts — 기능과
// 같은 커밋으로 버전).

type NoticesState =
  | { phase: 'loading' }
  | { phase: 'unavailable' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; notices: NoticeItem[]; sheetReady: boolean };

function NoticeCard({ notice }: { notice: NoticeItem }) {
  return (
    <article className={notice.level === 'WARN' ? 'help-notice help-notice--warn' : 'help-notice'}>
      <div className="help-notice-head">
        {notice.pinned && <span className="help-notice-pin">{t('views.help.pinned')}</span>}
        <span className={notice.level === 'WARN' ? 'help-notice-level help-notice-level--warn' : 'help-notice-level'}>
          {notice.level === 'WARN' ? t('views.help.levelWarn') : t('views.help.levelInfo')}
        </span>
        <h3>{notice.title}</h3>
      </div>
      {notice.body && <p className="help-notice-body">{notice.body}</p>}
      {notice.createdAt && <p className="help-notice-date">{notice.createdAt}</p>}
    </article>
  );
}

export default function HelpView(_props: ViewProps) {
  const locale = useLocale();
  const [noticesState, setNoticesState] = useState<NoticesState>({ phase: 'loading' });
  const [openSection, setOpenSection] = useState<string | null>(null);

  const load = useCallback(async () => {
    setNoticesState({ phase: 'loading' });
    const res = await fetchNotices();
    if (res.ok) {
      setNoticesState({ phase: 'ready', notices: res.notices, sheetReady: res.sheetReady });
      // 열람 = 읽음 — 부팅 토스트(checkNewNoticesOnBoot)의 기준점 갱신
      markNoticesSeen(res.notices);
    } else if (res.unavailable) {
      setNoticesState({ phase: 'unavailable' });
    } else {
      setNoticesState({ phase: 'error', message: res.message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const content: HelpContent = locale === 'en' ? HELP_EN : HELP_KO;

  return (
    <div className="help-view">
      <section className="help-notices">
        <h2>{t('views.help.noticesHeading')}</h2>
        {noticesState.phase === 'loading' && <p className="help-muted">{t('common.loading')}</p>}
        {noticesState.phase === 'unavailable' && <p className="help-muted">{t('views.help.noticesUnavailable')}</p>}
        {noticesState.phase === 'error' && (
          <p className="help-muted">
            {noticesState.message}{' '}
            <button type="button" className="ghost help-retry" onClick={() => void load()}>
              {t('common.retry')}
            </button>
          </p>
        )}
        {noticesState.phase === 'ready' &&
          (noticesState.notices.length === 0 ? (
            <p className="help-muted">{noticesState.sheetReady ? t('views.help.noticesEmpty') : t('views.help.noticesUnavailable')}</p>
          ) : (
            noticesState.notices.map((notice) => <NoticeCard key={notice.noticeId} notice={notice} />)
          ))}
      </section>

      <section className="help-guide">
        <h2>{t('views.help.guideHeading')}</h2>
        <div className="help-toc" role="list">
          {HELP_SECTION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={openSection === id ? 'help-toc-chip is-active' : 'help-toc-chip'}
              onClick={() => {
                setOpenSection(id);
                // 앵커 이동 — 뷰 내부 스크롤(셸 스크롤러가 담당하므로 scrollIntoView로 충분)
                document.getElementById(`help-sec-${id}`)?.scrollIntoView({ block: 'start' });
              }}
            >
              {content[id].title}
            </button>
          ))}
        </div>
        {HELP_SECTION_IDS.map((id) => {
          const section = content[id];
          return (
            <details
              key={id}
              id={`help-sec-${id}`}
              className="help-section"
              open={openSection === id || undefined}
              onToggle={(e) => {
                const isOpen = (e.target as HTMLDetailsElement).open;
                if (isOpen) setOpenSection(id);
                else if (openSection === id) setOpenSection(null); // 닫힘도 상태에 반영 — open 프롭 고정으로 안 닫히는 것 방지
              }}
            >
              <summary>{section.title}</summary>
              <div className="help-section-body">
                {section.blocks.map((block, index) => (
                  <div key={index} className="help-block">
                    {block.h && <h3>{block.h}</h3>}
                    {block.p && <p>{block.p}</p>}
                    {block.steps && (
                      <ol>
                        {block.steps.map((step, stepIndex) => (
                          <li key={stepIndex}>{step}</li>
                        ))}
                      </ol>
                    )}
                    {block.note && <p className="help-note">{block.note}</p>}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
        <p className="help-muted help-guide-foot">{t('views.help.guideFoot')}</p>
      </section>
    </div>
  );
}
