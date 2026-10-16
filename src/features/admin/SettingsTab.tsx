import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Coffee, Eye, EyeOff, Images, LogOut, Minus, MessageCircle, Palmtree, Plus, Trash2 } from 'lucide-react';
import { useBackend, useDb, useNow } from '@/data/store';
import type { Appointment, Service, Weekday } from '@/domain/types';
import { haptic } from '@/lib/platform';
import { DAY_LETTERS, MONTHS, fmtDayMonth, fmtDayMonthRange, fmtRange, fmtTime, fromKey, toKey, todayKey } from '@/lib/time';
import { Button, Stepper, Switch, TextInput } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { Sheet, SheetTitle } from '@/ui/Sheet';
import { useOnChange } from '@/ui/useOnChange';
import { TAB_BAR_SPACE } from '@/ui/TabBar';
import { useToast } from '@/ui/useToast';
import { customerPrice, firstName, money } from '../format';
import { GalleryTile } from '../shared/GalleryTile';
import { groupHours } from '../shared/hours';
import { useSendQueue } from './useSendQueue';
import { vacationMessage } from './vacation';

/**
 * "שירותים ושעות": prices, hidden prices, service types, opening hours, break, vacations, gallery picks.
 * Desk layout: a services table with inline price, hide and delete; hours and break cards beside it.
 */
export function SettingsTab({ layout = 'phone', onVacations }: { layout?: 'phone' | 'desk'; onVacations?: () => void }) {
  const backend = useBackend();
  const db = useDb();
  const toast = useToast();
  const now = useNow();
  const services = [...db.services].sort((a, b) => a.order - b.order);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);
  const [vacationOpen, setVacationOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const upcomingVacations = db.settings.vacations.filter((v) => v.to >= todayKey(now)).sort((a, b) => (a.from < b.from ? -1 : 1));

  const remove = async (s: Service) => {
    await backend.services.remove(s.id);
    haptic();
    toast({ text: `${s.name} נמחק`, action: { label: 'ביטול', run: () => backend.services.restore(s) } });
  };

  const sheets = (
    <>
      <ServiceSheet service={editing} onClose={() => setEditing(null)} />
      <HoursSheet open={hoursOpen} onClose={() => setHoursOpen(false)} />
      <BreakSheet open={breakOpen} onClose={() => setBreakOpen(false)} />
      <VacationSheet open={vacationOpen} onClose={() => setVacationOpen(false)} />
      <GalleryPinsSheet open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </>
  );

  if (layout === 'desk')
    return (
      <>
        <DeskSettings
          services={services}
          onRemove={remove}
          onEdit={setEditing}
          onHours={() => setHoursOpen(true)}
          onGallery={() => setGalleryOpen(true)}
          onVacations={onVacations ?? (() => setVacationOpen(true))}
        />
        {sheets}
      </>
    );

  return (
    <div className="absolute inset-0 overflow-y-auto pt-safe" style={{ paddingBottom: `calc(${TAB_BAR_SPACE} + 16px)` }}>
      <h1 className="m-0 px-5 pb-3.5 pt-6 text-[26px] font-bold tracking-display">שירותים ושעות</h1>

      <div className="flex items-center justify-between px-5 pb-2 text-sm font-semibold text-ink-soft">
        <span>סוגי תספורות ומחירים</span>
        <span className="flex items-center gap-1 text-xs font-normal">
          <EyeOff size={13} /> מסתיר מחיר מלקוחות
        </span>
      </div>
      <div className="mx-4 rounded-[18px] border border-line pe-2 ps-4">
        {services.map((s, i) => (
          <div key={s.id} className={cx('flex h-[54px] items-center gap-1.5', i < services.length - 1 && 'border-b border-line-soft')}>
            <button type="button" onClick={() => setEditing(s)} className="flex min-w-0 flex-1 flex-col text-right">
              <span className="truncate text-[15px] font-medium">{s.name}</span>
              <span className="text-[11px] text-ink-soft">{s.durationMin} דק׳</span>
            </button>
            <button
              type="button"
              aria-label={`הורד מחיר ${s.name}`}
              onClick={() => backend.services.update(s.id, { price: Math.max(0, s.price - 5) })}
              className="press flex size-8 items-center justify-center rounded-full bg-surface"
            >
              <Minus size={16} />
            </button>
            <span className={cx('num w-11 text-center text-base font-bold', s.priceHidden && 'text-ink-faint line-through')}>{money(s.price)}</span>
            <button
              type="button"
              aria-label={`העלה מחיר ${s.name}`}
              onClick={() => backend.services.update(s.id, { price: s.price + 5 })}
              className="press flex size-8 items-center justify-center rounded-full bg-surface"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              aria-label={s.priceHidden ? `הצג מחיר ${s.name} ללקוחות` : `הסתר מחיר ${s.name} מלקוחות`}
              aria-pressed={s.priceHidden}
              onClick={() => backend.services.update(s.id, { priceHidden: !s.priceHidden })}
              className={cx('press flex size-8 items-center justify-center rounded-full', s.priceHidden ? 'bg-brand text-brand-accent' : 'text-ink-soft')}
            >
              {s.priceHidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button type="button" aria-label={`מחק ${s.name}`} onClick={() => remove(s)} className="press flex size-8 items-center justify-center rounded-full text-danger">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setEditing('new')}
        className="press mx-4 mt-2 flex h-[52px] w-[calc(100%-32px)] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-ink-faint text-[15px] font-semibold"
      >
        <Plus size={18} />
        הוסף סוג תספורת
      </button>

      <div className="flex items-center justify-between pb-2 pe-4 ps-5 pt-5">
        <span className="text-sm font-semibold text-ink-soft">שעות פתיחה</span>
        <button
          type="button"
          onClick={() => setHoursOpen(true)}
          className="press flex h-9 items-center gap-1.5 rounded-[10px] bg-brand px-3 text-[13px] font-semibold text-brand-accent"
        >
          <Clock size={15} />
          ערוך שעות
        </button>
      </div>
      <div className="mx-4 rounded-[18px] border border-line px-4">
        {groupHours(db.settings).map((r) => (
          <div key={r.label} className={cx('flex h-[46px] items-center gap-2 border-b border-line-soft text-[15px]', !r.open && 'text-ink-soft')}>
            <span className="flex-1">{r.label}</span>
            <span dir="ltr" className={cx('num', r.open && 'font-medium')}>
              {r.value}
            </span>
            <Switch checked={r.open} label={`פתוח ${r.label}`} onChange={(v) => backend.settings.setHours(r.days, { ...db.settings.hours[r.days[0]], open: v })} />
          </div>
        ))}
        <div className="flex h-[46px] items-center gap-2 text-[15px]">
          <span className="flex flex-1 items-center gap-1.5">
            <Coffee size={16} />
            הפסקה קבועה
          </span>
          <span dir="ltr" className="num font-medium">
            {db.settings.breakTime ? fmtRange(db.settings.breakTime.from, db.settings.breakTime.to) : 'אין'}
          </span>
          <button type="button" onClick={() => setBreakOpen(true)} className="press h-9 rounded-[10px] bg-surface px-3 text-[13px] font-semibold">
            ערוך
          </button>
        </div>
      </div>

      <Button variant="danger" className="mx-4 mt-4 w-[calc(100%-32px)] text-base" icon={<Palmtree size={20} />} onClick={() => setVacationOpen(true)}>
        סמן ימי חופש
      </Button>
      {upcomingVacations.length > 0 && (
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {upcomingVacations.map((v) => (
            <div key={v.id} className="flex h-12 items-center gap-2 rounded-[14px] bg-surface pe-2 ps-4 text-sm">
              <Palmtree size={16} className="text-danger" />
              <span className="flex-1 font-medium">חופש {v.from === v.to ? fmtDayMonth(v.from) : fmtDayMonthRange(v.from, v.to)}</span>
              <button type="button" onClick={() => backend.settings.removeVacation(v.id)} className="press h-9 rounded-[10px] px-2.5 text-[13px] font-semibold text-ink-soft">
                בטל חופש
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setGalleryOpen(true)}
        className="press mx-4 mt-4 flex h-14 w-[calc(100%-32px)] items-center gap-3 rounded-2xl border border-line px-4 text-right"
      >
        <Images size={20} />
        <span className="flex-1 text-[15px] font-medium">תמונות נבחרות בדף המספרה</span>
        <span className="text-[13px] text-ink-soft">{db.gallery.filter((g) => g.pinned).length} מתוך 4</span>
        <ChevronLeft size={18} />
      </button>

      <button type="button" onClick={() => backend.auth.signOut()} className="mx-auto mt-6 flex h-11 items-center gap-2 px-4 text-sm font-medium text-ink-soft">
        <LogOut size={16} />
        התנתקות
      </button>

      {sheets}
    </div>
  );
}

interface DeskSettingsProps {
  services: Service[];
  onRemove: (s: Service) => void;
  onEdit: (s: Service) => void;
  onHours: () => void;
  onGallery: () => void;
  onVacations: () => void;
}

function DeskSettings({ services, onRemove, onEdit, onHours, onGallery, onVacations }: DeskSettingsProps) {
  const backend = useBackend();
  const db = useDb();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState(60);
  const [newDuration, setNewDuration] = useState(30);
  const brk = db.settings.breakTime;
  const [brkEditing, setBrkEditing] = useState(false);
  const [brkFrom, setBrkFrom] = useState(brk?.from ?? 13 * 60);
  const [brkLen, setBrkLen] = useState(brk ? brk.to - brk.from : 30);

  const addService = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await backend.services.add({ name, shortName: name, price: newPrice, durationMin: newDuration, priceHidden: false });
      haptic('success');
      setAdding(false);
      setNewName('');
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  };
  const editBreak = () => {
    setBrkFrom(brk?.from ?? 13 * 60);
    setBrkLen(brk ? brk.to - brk.from : 30);
    setBrkEditing(true);
  };
  const saveBreak = async (range: { from: number; to: number } | null) => {
    await backend.settings.setBreak(range);
    haptic('success');
    setBrkEditing(false);
  };
  const step = 'press flex size-8 items-center justify-center rounded-full bg-surface disabled:opacity-35';

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-brand text-[32px] font-normal leading-tight">שירותים ושעות</h1>
        <span className="text-[15px] text-ink-soft">מחירים, סוגי תספורות ושעות הפתיחה שהלקוחות רואים בזמן קביעת תור</span>
      </div>

      <div className="flex flex-wrap items-start gap-7">
        <section aria-labelledby="h-svc" className="flex min-w-0 flex-[1_1_560px] flex-col gap-3">
          <div className="flex items-end gap-3">
            <h2 id="h-svc" className="m-0 flex-1 text-lg font-bold">
              סוגי תספורות ומחירים
            </h2>
            <span className="flex items-center gap-1.5 text-[13px] text-ink-mute">
              <EyeOff size={14} /> העין מסתירה מחיר מלקוחות
            </span>
          </div>

          <div role="table" aria-label="סוגי תספורות ומחירים" className="overflow-hidden rounded-[20px] border border-line">
            <div role="row" className="flex h-11 items-center gap-3 bg-surface px-5 text-[13px] font-semibold text-ink-soft">
              <span role="columnheader" className="flex-1">
                סוג תספורת
              </span>
              <span role="columnheader" className="w-[148px] text-center">
                מחיר
              </span>
              <span role="columnheader" className="w-[130px]">
                הלקוח רואה
              </span>
              <span role="columnheader" className="w-[88px] text-center">
                פעולות
              </span>
            </div>
            {services.map((s) => (
              <div key={s.id} role="row" className="flex min-h-16 items-center gap-3 border-t border-line-soft px-5 hover:bg-surface/50">
                <button role="cell" type="button" onClick={() => onEdit(s)} title="עריכה" className="flex min-w-0 flex-1 flex-col text-right">
                  <span className="truncate text-[15px] font-semibold">{s.name}</span>
                  <span className="text-xs text-ink-mute">{s.durationMin} דק׳</span>
                </button>
                <div role="cell" className="flex w-[148px] items-center justify-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`הורד מחיר - ${s.name}`}
                    disabled={s.price <= 0}
                    onClick={() => backend.services.update(s.id, { price: Math.max(0, s.price - 5) })}
                    className={step}
                  >
                    <Minus size={16} />
                  </button>
                  <span aria-live="polite" className={cx('num w-[52px] text-center text-base font-bold', s.priceHidden && 'text-ink-faint line-through')}>
                    {money(s.price)}
                  </span>
                  <button type="button" aria-label={`העלה מחיר - ${s.name}`} onClick={() => backend.services.update(s.id, { price: s.price + 5 })} className={step}>
                    <Plus size={16} />
                  </button>
                </div>
                <span role="cell" className={cx('w-[130px] text-[13px]', s.priceHidden ? 'font-semibold text-danger' : 'text-ink-soft')}>
                  {customerPrice(s)}
                </span>
                <div role="cell" className="flex w-[88px] justify-center gap-2">
                  <button
                    type="button"
                    aria-pressed={s.priceHidden}
                    aria-label={s.priceHidden ? `הצג מחיר ללקוחות - ${s.name}` : `הסתר מחיר מלקוחות - ${s.name}`}
                    onClick={() => backend.services.update(s.id, { priceHidden: !s.priceHidden })}
                    className={cx(
                      'press flex size-9 items-center justify-center rounded-[10px]',
                      s.priceHidden ? 'bg-brand text-brand-accent' : 'border border-line text-ink-soft',
                    )}
                  >
                    {s.priceHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    aria-label={`מחק - ${s.name}`}
                    onClick={() => onRemove(s)}
                    className="press flex size-9 items-center justify-center rounded-[10px] text-danger hover:bg-danger-soft"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {adding && (
              <div role="row" className="flex min-h-[72px] flex-wrap items-center gap-3 border-t border-line-soft bg-surface/60 px-5 py-3">
                <label htmlFor="newsvc" className="sr-only">
                  שם סוג התספורת
                </label>
                <input
                  id="newsvc"
                  autoFocus
                  placeholder="שם, למשל: צבע לזקן"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addService()}
                  className="h-11 min-w-0 flex-[1_1_180px] rounded-xl border border-line bg-white px-3 text-[15px] outline-none focus:border-brand"
                />
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label="הורד מחיר לסוג החדש" onClick={() => setNewPrice((p) => Math.max(0, p - 5))} className={step}>
                    <Minus size={16} />
                  </button>
                  <span className="num w-[52px] text-center text-base font-bold">{money(newPrice)}</span>
                  <button type="button" aria-label="העלה מחיר לסוג החדש" onClick={() => setNewPrice((p) => p + 5)} className={step}>
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label="קצר יותר" disabled={newDuration <= 10} onClick={() => setNewDuration((d) => d - 5)} className={step}>
                    <Minus size={16} />
                  </button>
                  <span className="w-[60px] text-center text-sm font-semibold">{newDuration} דק׳</span>
                  <button type="button" aria-label="ארוך יותר" onClick={() => setNewDuration((d) => d + 5)} className={step}>
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={addService}
                  disabled={!newName.trim()}
                  className="h-11 rounded-xl bg-brand px-[18px] text-sm font-semibold text-brand-accent disabled:opacity-40"
                >
                  הוסף
                </button>
                <button type="button" onClick={() => setAdding(false)} className="h-11 rounded-xl px-3.5 text-sm font-semibold text-ink-soft">
                  ביטול
                </button>
              </div>
            )}
          </div>

          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="press flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-ink-faint text-[15px] font-semibold"
            >
              <Plus size={18} />
              הוסף סוג תספורת
            </button>
          )}

          <div className="mt-1.5 flex flex-col gap-2.5 rounded-[20px] bg-surface p-[18px]">
            <span className="text-sm font-bold">כך זה נראה ללקוח</span>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <span key={s.id} className="flex h-10 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm font-semibold">
                  {s.name}
                  <span className={cx('font-medium', s.priceHidden ? 'text-ink-mute' : 'text-ink-soft')}>{customerPrice(s)}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="flex min-w-[300px] flex-[0_1_380px] flex-col gap-4">
          <section aria-labelledby="h-hours" className="flex flex-col gap-1.5 rounded-[20px] border border-line p-[18px]">
            <div className="mb-1 flex items-center gap-2.5">
              <h2 id="h-hours" className="m-0 flex-1 text-lg font-bold">
                שעות פתיחה
              </h2>
              <button type="button" onClick={onHours} className="press flex h-10 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-sm font-semibold text-brand-accent">
                <Clock size={16} />
                ערוך שעות
              </button>
            </div>
            {groupHours(db.settings).map((r) => (
              <div key={r.label} className="flex h-11 items-center gap-3 border-b border-line-soft text-[15px] last:border-0">
                <span className="w-16 font-medium">{r.label}</span>
                <span dir="ltr" className={cx('num flex-1 text-right', r.open ? 'font-semibold' : 'text-ink-faint')}>
                  {r.open ? r.value : '-'}
                </span>
                <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', r.open ? 'bg-open-soft text-open-text' : 'bg-surface text-ink-soft')}>
                  {r.open ? 'פתוח' : 'סגור'}
                </span>
              </div>
            ))}
          </section>

          <section aria-labelledby="h-brk" className="flex flex-col gap-3 rounded-[20px] border border-line p-[18px]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-surface">
                <Coffee size={18} />
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <h2 id="h-brk" className="m-0 text-base font-bold">
                  הפסקה קבועה
                </h2>
                <span className="text-xs text-ink-mute">כל יום פתיחה • לא ניתן לקבוע בה תור</span>
              </div>
              <span className="num text-[15px] font-bold">{brk ? fmtRange(brk.from, brk.to) : 'אין'}</span>
            </div>
            {brkEditing ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium">מתחילה</span>
                  <button type="button" aria-label="מוקדם יותר" disabled={brkFrom <= 7 * 60} onClick={() => setBrkFrom((v) => v - 15)} className={step}>
                    <Minus size={16} />
                  </button>
                  <span className="num w-14 text-center font-bold">{fmtTime(brkFrom)}</span>
                  <button type="button" aria-label="מאוחר יותר" disabled={brkFrom + brkLen >= 22 * 60} onClick={() => setBrkFrom((v) => v + 15)} className={step}>
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium">אורך</span>
                  <button type="button" aria-label="הפסקה קצרה יותר" disabled={brkLen <= 15} onClick={() => setBrkLen((v) => v - 15)} className={step}>
                    <Minus size={16} />
                  </button>
                  <span className="w-14 text-center font-bold">{brkLen} דק׳</span>
                  <button type="button" aria-label="הפסקה ארוכה יותר" disabled={brkLen >= 120} onClick={() => setBrkLen((v) => v + 15)} className={step}>
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveBreak({ from: brkFrom, to: brkFrom + brkLen })}
                    className="press h-11 flex-1 rounded-xl bg-brand text-sm font-semibold text-brand-accent"
                  >
                    שמור הפסקה
                  </button>
                  {brk && (
                    <button type="button" onClick={() => saveBreak(null)} className="h-11 rounded-xl px-3 text-sm font-semibold text-danger">
                      בלי הפסקה
                    </button>
                  )}
                  <button type="button" onClick={() => setBrkEditing(false)} className="h-11 rounded-xl px-3 text-sm font-semibold text-ink-soft">
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={editBreak} className="h-11 rounded-xl border border-line text-sm font-semibold hover:border-ink-faint">
                {brk ? 'ערוך הפסקה' : 'הוסף הפסקה'}
              </button>
            )}
          </section>

          <button type="button" onClick={onVacations} className="press flex items-center gap-3 rounded-[20px] bg-danger-soft p-[18px] text-right text-danger">
            <Palmtree size={22} />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-base font-bold">סמן ימי חופש</span>
              <span className="text-[13px]">לקוחות לא יוכלו לקבוע בימים שתסמן</span>
            </span>
            <ChevronLeft size={18} />
          </button>

          <button type="button" onClick={onGallery} className="press flex items-center gap-3 rounded-[20px] border border-line p-[18px] text-right hover:border-ink-faint">
            <Images size={22} />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-base font-bold">תמונות נבחרות בדף המספרה</span>
              <span className="text-[13px] text-ink-soft">{db.gallery.filter((g) => g.pinned).length} מתוך 4 נעוצות</span>
            </span>
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiceSheet({ service, onClose }: { service: Service | 'new' | null; onClose: () => void }) {
  const backend = useBackend();
  const isNew = service === 'new';
  const [name, setName] = useState('');
  const [price, setPrice] = useState(70);
  const [duration, setDuration] = useState(30);
  useOnChange(service, (s) => {
    if (!s) return;
    setName(s === 'new' ? '' : s.name);
    setPrice(s === 'new' ? 70 : s.price);
    setDuration(s === 'new' ? 30 : s.durationMin);
  });
  const save = async () => {
    const clean = name.trim();
    if (isNew) await backend.services.add({ name: clean, shortName: clean.split(/[\s/+]/)[0], price, durationMin: duration, priceHidden: false });
    else if (service) await backend.services.update(service.id, { name: clean, price, durationMin: duration });
    haptic('success');
    onClose();
  };
  return (
    <Sheet
      open={!!service}
      onClose={onClose}
      label={isNew ? 'סוג תספורת חדש' : 'עריכת סוג תספורת'}
      footer={
        <Button block disabled={name.trim().length < 2} onClick={save}>
          {isNew ? 'הוסף' : 'שמור'}
        </Button>
      }
    >
      <SheetTitle>{isNew ? 'סוג תספורת חדש' : 'עריכת סוג תספורת'}</SheetTitle>
      <label htmlFor="svc-name" className="mt-4 block text-sm font-medium">
        שם
      </label>
      <TextInput id="svc-name" className="mt-1.5" placeholder="למשל: פייד + זקן" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="mt-3 flex flex-col gap-2.5">
        <Stepper
          label="מחיר"
          value={money(price)}
          decLabel="הורד מחיר"
          incLabel="העלה מחיר"
          canDec={price > 0}
          onDec={() => setPrice((p) => Math.max(0, p - 5))}
          onInc={() => setPrice((p) => p + 5)}
        />
        <Stepper
          label="משך"
          value={`${duration} דק׳`}
          decLabel="קצר יותר"
          incLabel="ארוך יותר"
          canDec={duration > 10}
          canInc={duration < 180}
          onDec={() => setDuration((d) => d - 5)}
          onInc={() => setDuration((d) => d + 5)}
        />
      </div>
    </Sheet>
  );
}

function HoursSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backend = useBackend();
  const db = useDb();
  const [picked, setPicked] = useState<Weekday[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [from, setFrom] = useState(540);
  const [to, setTo] = useState(1200);

  const load = (days: Weekday[]) => {
    const h = days.length ? db.settings.hours[days[0]] : null;
    if (h) {
      setIsOpen(h.open);
      setFrom(h.from);
      setTo(h.to);
    }
  };
  useOnChange(open, (isOpen) => {
    if (!isOpen) return;
    const sundayToThursday: Weekday[] = [0, 1, 2, 3, 4];
    setPicked(sundayToThursday);
    load(sundayToThursday);
  });

  const toggle = (d: Weekday) => {
    const next = picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d].sort((a, b) => a - b);
    if (!picked.length) load(next);
    setPicked(next);
  };
  const count = picked.length;
  const cta = count === 0 ? 'בחר לפחות יום אחד' : (isOpen ? `שמור ${fmtRange(from, to)}` : 'סמן כסגור') + (count > 1 ? ` ל-${count} ימים` : '');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="עריכת שעות פתיחה"
      footer={
        <Button
          block
          disabled={count === 0}
          onClick={async () => {
            await backend.settings.setHours(picked, { open: isOpen, from, to });
            haptic('success');
            onClose();
          }}
        >
          {cta}
        </Button>
      }
    >
      <SheetTitle>שעות פתיחה</SheetTitle>
      <p className="m-0 mt-1 text-[13px] text-ink-soft">בחר ימים, ואז את שעת הפתיחה והסגירה שלהם.</p>
      <div role="group" aria-label="ימים" className="mt-3.5 flex justify-between">
        {DAY_LETTERS.map((label, i) => {
          const on = picked.includes(i as Weekday);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(i as Weekday)}
              className={cx('press size-11 rounded-full text-[15px] font-semibold', on ? 'bg-brand text-brand-accent' : 'border border-line bg-white')}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex h-[52px] items-center justify-between rounded-[14px] bg-surface px-3.5">
        <span className="text-[15px] font-medium">פתוח בימים האלה</span>
        <Switch checked={isOpen} onChange={setIsOpen} label="פתוח בימים האלה" />
      </div>
      {isOpen && (
        <div className="mt-3 flex flex-col gap-2.5 pb-2">
          <Stepper
            label="פתיחה"
            value={fmtTime(from)}
            decLabel="פתיחה מוקדם יותר"
            incLabel="פתיחה מאוחר יותר"
            canDec={from > 360}
            canInc={from + 30 < to}
            onDec={() => setFrom((v) => v - 30)}
            onInc={() => setFrom((v) => v + 30)}
          />
          <Stepper
            label="סגירה"
            value={fmtTime(to)}
            decLabel="סגירה מוקדם יותר"
            incLabel="סגירה מאוחר יותר"
            canDec={to - 30 > from}
            canInc={to < 1380}
            onDec={() => setTo((v) => v - 30)}
            onInc={() => setTo((v) => v + 30)}
          />
        </div>
      )}
    </Sheet>
  );
}

function BreakSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backend = useBackend();
  const db = useDb();
  const [on, setOn] = useState(true);
  const [from, setFrom] = useState(780);
  const [to, setTo] = useState(810);
  useOnChange(open, (isOpen) => {
    if (!isOpen) return;
    const b = db.settings.breakTime;
    setOn(!!b);
    if (b) {
      setFrom(b.from);
      setTo(b.to);
    }
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="הפסקה קבועה"
      footer={
        <Button
          block
          onClick={async () => {
            await backend.settings.setBreak(on ? { from, to } : null);
            haptic('success');
            onClose();
          }}
        >
          {on ? `שמור הפסקה ${fmtRange(from, to)}` : 'שמור בלי הפסקה'}
        </Button>
      }
    >
      <SheetTitle>הפסקה קבועה</SheetTitle>
      <p className="m-0 mt-1 text-[13px] text-ink-soft">כל יום, לקוחות לא יוכלו לקבוע בזמן הזה.</p>
      <div className="mt-4 flex h-[52px] items-center justify-between rounded-[14px] bg-surface px-3.5">
        <span className="text-[15px] font-medium">יש הפסקה</span>
        <Switch checked={on} onChange={setOn} label="יש הפסקה" />
      </div>
      {on && (
        <div className="mt-3 flex flex-col gap-2.5 pb-2">
          <Stepper
            label="מ-"
            value={fmtTime(from)}
            decLabel="מוקדם יותר"
            incLabel="מאוחר יותר"
            canDec={from > 420}
            canInc={from + 15 < to}
            onDec={() => setFrom((v) => v - 15)}
            onInc={() => setFrom((v) => v + 15)}
          />
          <Stepper
            label="עד"
            value={fmtTime(to)}
            decLabel="מוקדם יותר"
            incLabel="מאוחר יותר"
            canDec={to - 15 > from}
            canInc={to < 1320}
            onDec={() => setTo((v) => v - 15)}
            onInc={() => setTo((v) => v + 15)}
          />
        </div>
      )}
    </Sheet>
  );
}

export function VacationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backend = useBackend();
  const db = useDb();
  const toast = useToast();
  const now = useNow();
  const today = todayKey(now);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [affected, setAffected] = useState<Appointment[] | null>(null);

  useOnChange(open, (isOpen) => {
    if (!isOpen) return;
    setMonth(today.slice(0, 7));
    setStart(null);
    setEnd(null);
    setAffected(null);
  });

  const first = fromKey(month + '-01');
  const offset = first.getDay();
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const last = end ?? start;
  const inRange = (d: string) => !!start && !!last && d >= start && d <= last;
  const booked = useMemo(() => (start ? db.appointments.filter((a) => a.status === 'booked' && a.date >= start && a.date <= (last ?? start)) : []), [db.appointments, start, last]);
  const days = start ? Math.round((fromKey(last!).getTime() - fromKey(start).getTime()) / 86400000) + 1 : 0;
  const shiftMonth = (n: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 1);
    setMonth(toKey(d).slice(0, 7));
  };

  const queue = useSendQueue(
    (affected ?? [])
      .filter((a) => a.phone)
      .map((a) => ({
        key: a.id,
        name: a.customerName,
        phone: a.phone,
        text: vacationMessage(a),
      })),
  );

  const save = async () => {
    if (!start) return;
    const hit = booked;
    try {
      await backend.settings.addVacation(start, last!);
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
      return;
    }
    haptic('success');
    if (notify && hit.some((a) => a.phone)) setAffected(hit);
    else onClose();
  };

  if (affected) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        label="הודעה ללקוחות"
        footer={
          <Button
            block
            variant={queue.next ? 'whatsapp' : 'primary'}
            icon={queue.next ? <MessageCircle size={20} /> : undefined}
            onClick={() => (queue.next ? queue.sendNext() : onClose())}
          >
            {queue.next ? `שלח ל${firstName(queue.next.name)} (${queue.sentCount + 1}/${queue.total})` : 'סיום'}
          </Button>
        }
      >
        <SheetTitle aside={`${queue.sentCount}/${queue.total} נשלחו`}>החופש נשמר</SheetTitle>
        <p className="m-0 mt-1 text-[13px] text-ink-soft">התורים בימים האלה בוטלו. שלח לכל לקוח הודעה לקביעה מחדש:</p>
        <div className="mt-3 flex flex-col gap-2 pb-2">
          {queue.total === 0 && <p className="text-ink-soft">אין למי לשלוח.</p>}
          {(affected ?? [])
            .filter((a) => a.phone)
            .map((a) => (
              <div key={a.id} className="flex h-14 items-center gap-2 rounded-2xl border border-line pe-2 ps-3.5 text-sm">
                <span className="flex-1 font-semibold">{a.customerName}</span>
                <span className="num text-ink-soft">
                  {fmtDayMonth(a.date)} • {fmtTime(a.start)}
                </span>
                <span className={cx('flex h-9 items-center rounded-[10px] px-2.5 text-[13px] font-semibold', queue.isSent(a.id) ? 'text-open-text' : 'text-ink-faint')}>
                  {queue.isSent(a.id) ? 'נשלח ✓' : 'ממתין'}
                </span>
              </div>
            ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="ימי חופש"
      footer={
        <Button block disabled={!start} onClick={save}>
          {!start ? 'בחר ימים' : `סמן ${days === 1 ? 'יום' : `${days} ימים`} כחופש`}
        </Button>
      }
    >
      <SheetTitle>ימי חופש</SheetTitle>
      <p className="m-0 mt-1 text-[13px] text-ink-soft">לחץ על יום ההתחלה ואז על יום הסוף.</p>
      <div className="mt-3.5 flex items-center justify-between">
        <button
          type="button"
          aria-label="חודש קודם"
          disabled={month <= today.slice(0, 7)}
          onClick={() => shiftMonth(-1)}
          className="press flex size-10 items-center justify-center rounded-full bg-surface disabled:opacity-35"
        >
          <ChevronRight size={18} />
        </button>
        <span className="text-base font-semibold">
          {MONTHS[first.getMonth()]} {first.getFullYear()}
        </span>
        <button type="button" aria-label="חודש הבא" onClick={() => shiftMonth(1)} className="press flex size-10 items-center justify-center rounded-full bg-surface">
          <ChevronLeft size={18} />
        </button>
      </div>
      <div aria-hidden className="mt-2.5 grid grid-cols-7 text-center text-xs font-semibold text-ink-soft">
        {DAY_LETTERS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-y-1">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, '0')}`;
          const past = d < today;
          const edge = d === start || d === last;
          const mid = inRange(d) && !edge;
          return (
            <button
              key={d}
              type="button"
              disabled={past}
              aria-label={`${i + 1} ב${MONTHS[first.getMonth()]}`}
              aria-pressed={inRange(d)}
              onClick={() => {
                if (!start || end) {
                  setStart(d);
                  setEnd(null);
                } else if (d < start) setStart(d);
                else setEnd(d);
              }}
              className={cx(
                'num h-11 text-[15px] font-medium',
                past && 'text-line-strong',
                edge && 'rounded-xl bg-brand font-bold text-brand-accent',
                mid && 'bg-surface-sunk',
                !edge && !mid && 'rounded-xl',
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-3.5 flex flex-col gap-1.5 rounded-2xl bg-surface px-4 py-3.5">
        <span className="text-[17px] font-bold">{!start ? 'בחר ימים' : days === 1 ? `${fmtDayMonth(start)} • יום אחד` : `${fmtDayMonthRange(start, last!)} • ${days} ימים`}</span>
        <span className="text-[13px] text-ink-soft">
          {!start ? 'עוד לא נבחרו ימים' : booked.length ? `יש ${booked.length} תורים בימים האלה. הם יבוטלו, ולקוחות לא יוכלו לקבוע בהם תור חדש.` : 'אין תורים בימים האלה.'}
        </span>
      </div>
      {booked.length > 0 && (
        <div className="mt-2.5 flex h-12 items-center justify-between gap-3 pb-1">
          <span className="text-[15px] font-medium">שלח ללקוחות האלה וואטסאפ לקביעה מחדש</span>
          <Switch checked={notify} onChange={setNotify} label="שלח ללקוחות וואטסאפ" />
        </div>
      )}
    </Sheet>
  );
}

function GalleryPinsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backend = useBackend();
  const db = useDb();
  const toast = useToast();
  const items = [...db.gallery].sort((a, b) => a.order - b.order);
  const pinnedCount = items.filter((g) => g.pinned).length;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="תמונות נבחרות"
      footer={
        <Button block onClick={onClose}>
          סיום
        </Button>
      }
    >
      <SheetTitle aside={`${pinnedCount} מתוך 4`}>תמונות נבחרות</SheetTitle>
      <p className="m-0 mt-1 text-[13px] text-ink-soft">4 התמונות שמופיעות ראשונות בדף המספרה. לחץ על תמונה כדי לבחור או להסיר.</p>
      <div className="mt-3 grid grid-cols-3 gap-1 pb-2">
        {items.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={g.pinned}
            aria-label={g.pinned ? 'הסר מהנבחרות' : 'הוסף לנבחרות'}
            onClick={() => {
              if (!g.pinned && pinnedCount >= 4) {
                toast({ text: 'אפשר לבחור עד 4 תמונות. הסר אחת קודם.' });
                return;
              }
              backend.gallery.togglePin(g.id);
              haptic();
            }}
            className={cx('press overflow-hidden rounded-lg', g.pinned && 'ring-2 ring-brand ring-offset-1')}
          >
            <GalleryTile item={g} className="h-[100px]" />
          </button>
        ))}
      </div>
      <p className="m-0 text-xs text-ink-mute">העלאת תמונות חדשות תתווסף עם החיבור ל-Firebase Storage.</p>
    </Sheet>
  );
}
