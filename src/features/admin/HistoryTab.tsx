import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Scissors, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { useDb, useNow } from '@/data/store';
import { formatPhone, phoneDigits } from '@/lib/phone';
import { MONTHS, MONTHS_SHORT, fmtShortDate, fmtTime, fromKey, isPast, monthKey } from '@/lib/time';
import { cx } from '@/ui/cx';
import { TAB_BAR_SPACE } from '@/ui/TabBar';
import { spring } from '@/ui/motion';
import { money } from '../format';

interface MonthStat {
  key: string;
  revenue: number;
  count: number;
  top: string;
}

/** "היסטוריה": monthly revenue chart (6 months per page), month stats, searchable past appointments. */
export function HistoryTab({ layout = 'phone' }: { layout?: 'phone' | 'desk' }) {
  const db = useDb();
  const now = useNow();
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(4);
  const [query, setQuery] = useState('');

  const { stats, pages, past } = useMemo(() => {
    const past = db.appointments.filter((a) => isPast(a.date, a.end, now));
    const by = new Map<string, { revenue: number; count: number; svc: Map<string, number> }>();
    for (const a of past) {
      if (a.status !== 'booked') continue;
      const k = monthKey(a.date);
      const m = by.get(k) ?? { revenue: 0, count: 0, svc: new Map() };
      m.revenue += a.price;
      m.count += 1;
      const short = db.services.find((x) => x.id === a.serviceId)?.shortName ?? a.serviceName;
      m.svc.set(short, (m.svc.get(short) ?? 0) + 1);
      by.set(k, m);
    }
    const earliest = past.reduce((min, a) => (a.date < min ? a.date : min), monthKey(now.toISOString().slice(0, 10)) + '-01');
    const cur = new Date(now.getFullYear(), now.getMonth(), 1);
    const span = (cur.getFullYear() - fromKey(earliest).getFullYear()) * 12 + cur.getMonth() - fromKey(earliest).getMonth() + 1;
    const pages = Math.max(1, Math.ceil(span / 6));
    const stats = (p: number): MonthStat[] =>
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(cur.getFullYear(), cur.getMonth() - (p * 6 + 5 - i), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const m = by.get(key);
        const top = m ? [...m.svc.entries()].sort((a, b) => b[1] - a[1])[0][0] : '-';
        return { key, revenue: m?.revenue ?? 0, count: m?.count ?? 0, top };
      });
    return { stats, pages, past };
  }, [db.appointments, db.services, now]);

  const months = stats(page);
  const cur = months[sel];
  const prev = sel > 0 ? months[sel - 1] : stats(page + 1)[5];
  const isCurrent = page === 0 && sel === 5;
  const max = Math.max(1, ...months.map((m) => m.revenue));
  const pct = prev && prev.revenue ? Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100) : null;
  const label = (key: string, long = false) => {
    const d = fromKey(key + '-01');
    const yearSuffix = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
    return (long ? MONTHS : MONTHS_SHORT)[d.getMonth()] + yearSuffix;
  };

  const rows = useMemo(() => {
    const q = query.trim();
    const qd = phoneDigits(q);
    const list = q ? past.filter((a) => a.customerName.includes(q) || (qd.length >= 3 && a.phone.includes(qd))) : past.filter((a) => monthKey(a.date) === cur.key);
    return list.sort((a, b) => (a.date === b.date ? b.start - a.start : a.date < b.date ? 1 : -1)).slice(0, 60);
  }, [past, query, cur.key]);

  const older = () => {
    setPage((p) => p + 1);
    setSel(5);
  };
  const newer = () => {
    setPage((p) => p - 1);
    setSel(page === 1 ? 4 : 0);
  };

  if (layout === 'desk') {
    const total = months.reduce((t, m) => t + m.revenue, 0);
    return (
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 font-brand text-[32px] font-normal leading-tight">היסטוריה והכנסות</h1>
            <span className="text-[15px] text-ink-soft">לחץ על חודש בגרף כדי לראות את הנתונים והתורים שלו</span>
          </div>
          <div className="mr-auto flex h-11 items-center rounded-xl border border-line">
            <button
              type="button"
              aria-label="6 חודשים קודמים"
              disabled={page >= pages - 1}
              onClick={older}
              className="flex size-11 items-center justify-center rounded-xl hover:bg-surface disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
            <span className="min-w-[150px] text-center text-sm font-semibold">
              {label(months[0].key, true)} - {label(months[5].key, true)}
            </span>
            <button
              type="button"
              aria-label="6 חודשים הבאים"
              disabled={page === 0}
              onClick={newer}
              className="flex size-11 items-center justify-center rounded-xl hover:bg-surface disabled:opacity-30"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-4">
          <section aria-labelledby="h-chart" className="flex min-w-0 flex-[1_1_600px] flex-col gap-1.5 rounded-[20px] border border-line px-6 pb-[18px] pt-[22px]">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 id="h-chart" className="m-0 text-lg font-bold">
                הכנסות לפי חודש
              </h2>
              <span className="text-[13px] text-ink-mute">{money(total)} בחצי השנה הזו</span>
            </div>
            <div role="group" aria-label="הכנסות לפי חודש, לחץ על חודש" className="mt-3.5 flex h-[280px] items-end gap-[18px] border-b border-line px-2">
              {months.map((m, i) => {
                const on = i === sel;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setSel(i)}
                    aria-label={`${label(m.key, true)}: ${money(m.revenue)}`}
                    aria-pressed={on}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className={cx('flex h-[26px] items-center rounded-full px-2.5 text-[13px] font-bold', on ? 'bg-brand text-brand-accent' : 'text-ink-soft')}>
                      {money(m.revenue)}
                    </span>
                    <motion.span
                      className={cx('w-[64%] max-w-[72px] rounded-t-lg transition-colors duration-200', on ? 'bg-brand' : 'bg-bar group-hover:bg-ink-mute')}
                      initial={false}
                      animate={{ height: Math.max(2, Math.round((m.revenue / max) * 220)) }}
                      transition={spring.ui}
                    />
                  </button>
                );
              })}
            </div>
            <div aria-hidden className="flex gap-[18px] px-2">
              {months.map((m, i) => (
                <span key={m.key} className={cx('flex-1 pt-2 text-center text-sm', i === sel ? 'font-bold text-ink' : 'text-ink-soft')}>
                  {label(m.key, true)}
                </span>
              ))}
            </div>
          </section>

          <div className="grid max-w-full flex-[1_1_320px] grid-cols-2 content-stretch gap-3">
            <div className="col-span-2 flex flex-col gap-2 rounded-[20px] bg-brand p-5 text-white">
              <span className="text-sm text-line-strong">
                הכנסות ב{label(cur.key, true)}
                {isCurrent ? ' (עד היום)' : ''}
              </span>
              <span className="num text-[40px] font-bold leading-none tracking-display">{money(cur.revenue)}</span>
              {isCurrent ? (
                <span className="flex h-[26px] items-center self-start rounded-full bg-white/10 px-2.5 text-[13px] font-semibold">החודש עוד באמצע</span>
              ) : (
                pct !== null && (
                  <span
                    className={cx(
                      'flex h-[26px] items-center gap-1 self-start rounded-full px-2.5 text-[13px] font-semibold',
                      pct >= 0 ? 'bg-open-soft text-open-text' : 'bg-danger-soft text-danger',
                    )}
                  >
                    {pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(pct)}% מ{label(prev.key, true)}
                  </span>
                )
              )}
            </div>
            <div className="flex flex-col gap-1.5 rounded-[18px] bg-surface p-[18px]">
              <span className="num text-[28px] font-bold leading-none">{cur.count}</span>
              <span className="text-sm text-ink-soft">תורים</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-[18px] bg-surface p-[18px]">
              <span className="num text-[28px] font-bold leading-none">{cur.count ? money(Math.round(cur.revenue / cur.count)) : '-'}</span>
              <span className="text-sm text-ink-soft">ממוצע לתור</span>
            </div>
            <div className="col-span-2 flex items-center gap-3 rounded-[18px] bg-surface p-[18px]">
              <span className="flex size-10 items-center justify-center rounded-full bg-white">
                <Scissors size={18} />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold">{cur.top}</span>
                <span className="text-sm text-ink-soft">השירות הכי מוזמן</span>
              </div>
            </div>
          </div>
        </div>

        <section aria-labelledby="h-list" className="overflow-hidden rounded-[20px] border border-line">
          <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-[18px]">
            <div className="flex flex-col gap-0.5">
              <h2 id="h-list" className="m-0 text-lg font-bold">
                {query ? 'תוצאות חיפוש' : `התורים ב${label(cur.key, true)}`}
              </h2>
              <span className="text-[13px] text-ink-mute">{rows.length === 60 ? '60 האחרונים' : `${rows.length} תורים`}</span>
            </div>
            <div className="mr-auto flex h-11 flex-[0_1_340px] items-center gap-2 rounded-xl border border-line px-3.5">
              <Search size={18} className="text-ink-soft" />
              <label htmlFor="dhsearch" className="sr-only">
                חיפוש לקוח
              </label>
              <input
                id="dhsearch"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש לפי שם או טלפון"
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none"
              />
            </div>
          </div>
          <div role="table" aria-labelledby="h-list">
            <div role="row" className="grid grid-cols-[150px_minmax(0,1.4fr)_minmax(0,1.2fr)_110px_90px] gap-3 bg-surface px-5 py-3 text-[13px] font-semibold text-ink-soft">
              <span role="columnheader">תאריך</span>
              <span role="columnheader">לקוח</span>
              <span role="columnheader">שירות</span>
              <span role="columnheader">סטטוס</span>
              <span role="columnheader" className="text-left">
                מחיר
              </span>
            </div>
            {rows.map((a) => {
              const cancelled = a.status === 'cancelled';
              return (
                <div
                  key={a.id}
                  role="row"
                  className="grid min-h-[58px] grid-cols-[150px_minmax(0,1.4fr)_minmax(0,1.2fr)_110px_90px] items-center gap-3 border-t border-line-soft px-5 py-2"
                >
                  <div role="cell" className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{fmtShortDate(a.date)}</span>
                    <span className="num text-xs text-ink-mute">{fmtTime(a.start)}</span>
                  </div>
                  <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-medium">{a.customerName}</span>
                    {a.phone && (
                      <span dir="ltr" className="text-right text-xs text-ink-mute">
                        {formatPhone(a.phone)}
                      </span>
                    )}
                  </div>
                  <span role="cell" className="truncate text-sm">
                    {a.serviceName}
                  </span>
                  <span role="cell">
                    <span
                      className={cx(
                        'inline-flex h-[26px] items-center rounded-full px-2.5 text-xs font-semibold',
                        cancelled ? 'bg-danger-soft text-danger' : 'bg-open-soft text-open-text',
                      )}
                    >
                      {cancelled ? 'בוטל' : 'הגיע'}
                    </span>
                  </span>
                  <span role="cell" className={cx('num text-left text-[15px] font-semibold', cancelled && 'text-ink-faint line-through')}>
                    {money(a.price)}
                  </span>
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-1.5 border-t border-line-soft px-5 py-10 text-center">
                <span className="text-base font-semibold">לא נמצאו תורים</span>
                <span className="text-sm text-ink-soft">{query ? `אין תורים שמתאימים ל"${query}"` : 'אין תורים בחודש הזה'}</span>
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="mt-1.5 h-10 rounded-xl border border-line px-4 text-sm font-semibold">
                    נקה חיפוש
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pt-safe" style={{ paddingBottom: `calc(${TAB_BAR_SPACE} + 16px)` }}>
      <header className="flex items-center justify-between px-5 pt-5">
        <h1 className="m-0 font-brand text-2xl font-normal leading-tight">היסטוריה</h1>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="6 חודשים קודמים"
            disabled={page >= pages - 1}
            onClick={older}
            className="press flex size-10 items-center justify-center rounded-full bg-surface disabled:opacity-35"
          >
            <ChevronRight size={18} />
          </button>
          <span className="min-w-[112px] text-center text-[13px] font-semibold">
            {label(months[0].key)} - {label(months[5].key)}
          </span>
          <button
            type="button"
            aria-label="6 חודשים הבאים"
            disabled={page === 0}
            onClick={newer}
            className="press flex size-10 items-center justify-center rounded-full bg-surface disabled:opacity-35"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      </header>

      <section aria-label="סיכום החודש" className="flex flex-col gap-1 px-5 pt-4">
        <span className="text-sm text-ink-soft">
          הכנסות ב{label(cur.key, true)}
          {isCurrent ? ' (עד היום)' : ''}
        </span>
        <div className="flex items-baseline gap-2.5">
          <span className="num text-4xl font-bold tracking-display">{money(cur.revenue)}</span>
          {isCurrent ? (
            <span className="text-[13px] font-semibold text-ink-soft">החודש עוד באמצע</span>
          ) : (
            pct !== null && (
              <span className={cx('flex items-center gap-1 text-[13px] font-semibold', pct >= 0 ? 'text-open-text' : 'text-danger')}>
                {pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(pct)}% מ{label(prev.key, true)}
              </span>
            )
          )}
        </div>
      </section>

      <div role="group" aria-label="הכנסות לפי חודש, לחץ על חודש" className="mx-4 mt-3.5 flex h-[150px] items-end gap-1.5 border-b border-line">
        {months.map((m, i) => {
          const on = i === sel;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSel(i)}
              aria-label={`${label(m.key, true)}: ${money(m.revenue)}`}
              aria-pressed={on}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span className={cx('text-[11px] font-semibold transition-opacity', on ? 'opacity-100' : 'opacity-0')}>{(m.revenue / 1000).toFixed(1).replace('.0', '')}K</span>
              <motion.span
                className={cx('w-[70%] rounded-t transition-colors duration-200', on ? 'bg-brand' : 'bg-bar')}
                initial={false}
                animate={{ height: Math.max(2, Math.round((m.revenue / max) * 120)) }}
                transition={spring.ui}
              />
            </button>
          );
        })}
      </div>
      <div aria-hidden className="mx-4 mt-1.5 flex gap-1.5">
        {months.map((m, i) => (
          <span key={m.key} className={cx('flex-1 text-center text-xs', i === sel ? 'font-bold text-ink' : 'font-medium text-ink-soft')}>
            {MONTHS_SHORT[fromKey(m.key + '-01').getMonth()]}
          </span>
        ))}
      </div>

      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        {[
          [String(cur.count), 'תורים'],
          [cur.count ? money(Math.round(cur.revenue / cur.count)) : '-', 'ממוצע לתור'],
          [cur.top, 'הכי מוזמן'],
        ].map(([v, k]) => (
          <div key={k} className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3 py-2.5">
            <span className="num truncate text-lg font-bold">{v}</span>
            <span className="text-xs text-ink-soft">{k}</span>
          </div>
        ))}
      </div>

      <div className="mx-4 mt-4 flex h-11 items-center gap-2 rounded-[14px] border border-line px-3.5">
        <Search size={18} className="text-ink-soft" />
        <label htmlFor="hsearch" className="sr-only">
          חיפוש לקוח
        </label>
        <input
          id="hsearch"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם או טלפון"
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none"
        />
      </div>

      <div className="mx-4 mt-2.5 flex flex-col">
        {rows.length === 0 && <p className="py-6 text-center text-ink-soft">{query ? 'לא נמצאו תורים' : 'אין תורים בחודש הזה'}</p>}
        {rows.map((a) => {
          const cancelled = a.status === 'cancelled';
          const d = fromKey(a.date);
          return (
            <div key={a.id} className="flex h-[54px] items-center gap-2.5 border-b border-line-soft">
              <span className="num w-10 text-xs leading-tight text-ink-soft">
                {d.getDate()}.{d.getMonth() + 1}
                <br />
                {fmtTime(a.start)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-medium">{a.customerName}</span>
                <span className="truncate text-xs text-ink-soft">
                  {a.serviceName}
                  {cancelled ? ' • בוטל' : ''}
                </span>
              </div>
              <span className={cx('num text-[15px] font-semibold', cancelled && 'text-danger')}>{cancelled ? '-' : money(a.price)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
