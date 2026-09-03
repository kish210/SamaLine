import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { contactsApi, describeError } from '../api';

export function ContactsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [selectedList, setSelectedList] = useState('');
  const [csv, setCsv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: string[];
  } | null>(null);

  const lists = useQuery({
    queryKey: ['contact-lists'],
    queryFn: contactsApi.lists,
  });

  const contacts = useQuery({
    queryKey: ['contacts', selectedList],
    queryFn: () => contactsApi.contacts(selectedList),
    enabled: Boolean(selectedList),
  });

  const createList = useMutation({
    mutationFn: () => contactsApi.createList(name),
    onSuccess: async () => {
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['contact-lists'] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const importCsv = useMutation({
    mutationFn: () => contactsApi.importCsv(selectedList, csv),
    onSuccess: async (result) => {
      setImportResult(result);
      setCsv('');
      await queryClient.invalidateQueries({ queryKey: ['contacts', selectedList] });
    },
    onError: (err) => setError(describeError(err)),
  });

  return (
    <div className="page">
      <header className="page-header">
        <h1>دفترچه مخاطبان</h1>
        <div className="inline-form">
          <input
            placeholder="نام فهرست جدید"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            disabled={!name.trim() || createList.isPending}
            onClick={() => createList.mutate()}
          >
            ساخت فهرست
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="two-col">
        <section className="card">
          <h3>فهرست‌ها</h3>
          {lists.data?.length === 0 && <p className="empty">فهرستی وجود ندارد.</p>}
          <ul className="list">
            {lists.data?.map((list) => (
              <li key={list.id}>
                <button
                  type="button"
                  className={
                    selectedList === list.id ? 'list-item active' : 'list-item'
                  }
                  onClick={() => setSelectedList(list.id)}
                >
                  {list.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>مخاطبان</h3>
          {!selectedList && <p className="empty">یک فهرست را انتخاب کنید.</p>}

          {selectedList && (
            <>
              <label>
                بارگذاری گروهی — هر خط: نام,موبایل,ایمیل
                <textarea
                  rows={5}
                  value={csv}
                  placeholder={'مریم,09120000001,\nعلی,09120000002,ali@test.local'}
                  onChange={(e) => setCsv(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={!csv.trim() || importCsv.isPending}
                onClick={() => importCsv.mutate()}
              >
                بارگذاری
              </button>

              {importResult && (
                <p className="hint">
                  {importResult.created} مخاطب جدید، {importResult.updated}{' '}
                  به‌روزرسانی
                  {importResult.skipped.length > 0 &&
                    `، ${importResult.skipped.length} رد شده (بدون موبایل و ایمیل)`}
                </p>
              )}

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>نام</th>
                      <th>موبایل</th>
                      <th>ایمیل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.data?.map((contact) => (
                      <tr key={contact.id}>
                        <td>{contact.fullName ?? '—'}</td>
                        <td>{contact.mobile ?? '—'}</td>
                        <td>{contact.email ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
