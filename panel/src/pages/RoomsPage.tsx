import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { describeError, roomsApi } from "../api";
import type { HotelRoom } from "../api";
import { useAuth } from "../auth";
import { hasRole } from "../types";

/**
 * اتاق‌های هتل به‌عنوان داده‌ی پایه.
 *
 * فرم‌های عملیاتی بعدا می‌توانند به‌جای تایپِ دستیِ شماره اتاق، از همین
 * فهرست انتخاب کنند تا سوابقِ هر اتاق یکدست بماند. برای هتلِ بزرگ، «ساخت
 * گروهی» یک‌بار همه‌ی طبقات و اتاق‌ها را می‌سازد.
 */
export function RoomsPage() {
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  const canEdit = hasRole(me?.role ?? null, "admin");

  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [kind, setKind] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rooms = useQuery({ queryKey: ["rooms"], queryFn: roomsApi.list });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["rooms"] });

  const create = useMutation({
    mutationFn: () =>
      roomsApi.create({
        number: number.trim(),
        floor: Number(floor) || 0,
        kind: kind.trim(),
      }),
    onSuccess: async () => {
      setError(null);
      setNumber("");
      setKind("");
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const bulk = useMutation({
    mutationFn: (body: { floors: number; roomsPerFloor: number; numberingBase: number }) =>
      roomsApi.bulk(body),
    onSuccess: async (res) => {
      setError(null);
      await refresh();
      window.alert(`${res.created} اتاق ساخته شد (${res.skipped} تکراری رد شد).`);
    },
    onError: (err) => setError(describeError(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => roomsApi.remove(id),
    onSuccess: refresh,
    onError: (err) => setError(describeError(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (number.trim()) create.mutate();
  };

  const filtered = useMemo(() => {
    const needle = filter.trim();
    const list = rooms.data ?? [];
    if (!needle) return list;
    return list.filter(
      (r) => r.number.includes(needle) || String(r.floor).includes(needle),
    );
  }, [rooms.data, filter]);

  const byFloor = useMemo(() => {
    const map = new Map<number, HotelRoom[]>();
    for (const room of filtered) {
      const arr = map.get(room.floor) ?? [];
      arr.push(room);
      map.set(room.floor, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const runBulk = () => {
    const floors = Number(window.prompt("چند طبقه؟", "16"));
    if (!floors) return;
    const perFloor = Number(window.prompt("هر طبقه چند اتاق؟", "12"));
    if (!perFloor) return;
    const base = Number(window.prompt("ضریبِ شماره‌گذاری (مثلا ۱۰۰ → اتاق ۳۰۵)", "100")) || 100;
    bulk.mutate({ floors, roomsPerFloor: perFloor, numberingBase: base });
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>اتاق‌های هتل</h1>
        {canEdit && (
          <button type="button" className="secondary" onClick={runBulk}>
            ساخت گروهی طبقات و اتاق‌ها
          </button>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      {canEdit && (
        <section className="card">
          <form className="inline-form" onSubmit={submit}>
            <input
              placeholder="شماره اتاق"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
            <input
              type="number"
              placeholder="طبقه"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              style={{ maxWidth: 100 }}
            />
            <input
              placeholder="نوع (اختیاری)"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            />
            <button type="submit" disabled={create.isPending || !number.trim()}>
              افزودن اتاق
            </button>
          </form>
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h3>{rooms.data?.length ?? 0} اتاق</h3>
          <input
            className="table-search"
            placeholder="جستجوی شماره یا طبقه…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {rooms.isLoading && <p>در حال بارگذاری…</p>}
        {rooms.data?.length === 0 && (
          <p className="empty">
            هنوز اتاقی ثبت نشده. از «ساخت گروهی» همه‌ی طبقات را یک‌جا بسازید.
          </p>
        )}

        {byFloor.map(([floorNo, floorRooms]) => (
          <div key={floorNo} className="floor-block">
            <h4>طبقه {floorNo}</h4>
            <div className="room-grid">
              {floorRooms.map((room) => (
                <span
                  key={room.id}
                  className={room.isActive ? "room-chip" : "room-chip off"}
                  title={room.kind || undefined}
                >
                  {room.number}
                  {canEdit && (
                    <button
                      type="button"
                      className="room-del"
                      title="حذف اتاق"
                      onClick={() => {
                        if (window.confirm(`اتاق ${room.number} حذف شود؟`)) {
                          remove.mutate(room.id);
                        }
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
