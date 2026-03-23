'use client';

import { useState, useRef, type FormEvent, type ChangeEvent } from 'react';

type RequestType = 'bug' | 'feature' | 'improvement';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function SubmitPage() {
  const [form, setForm] = useState({
    type: 'feature' as RequestType,
    title: '',
    description: '',
    submitted_by_name: '',
    submitted_by_email: '',
    submitted_by_phone: '',
    honeypot: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function validate(field: string, value: string): string | undefined {
    if (field === 'title') {
      if (!value.trim()) return 'Title is required.';
      if (value.trim().length < 5) return 'Title must be at least 5 characters.';
    }
    if (field === 'description') {
      if (!value.trim()) return 'Description is required.';
      if (value.trim().length < 20) return 'Please provide more detail (at least 20 characters).';
    }
    if (field === 'submitted_by_email' && value.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Please enter a valid email.';
    }
    return undefined;
  }

  function handleBlur(field: string) {
    setTouched(t => ({ ...t, [field]: true }));
    const err = validate(field, (form as Record<string, string>)[field] || '');
    setFieldErrors(prev => ({ ...prev, [field]: err || '' }));
  }

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    const combined = [...files, ...selected].slice(0, MAX_FILES);

    // Validate each file
    for (const f of selected) {
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.type)) {
        setErrorMsg(`"${f.name}" is not a supported image type. Use JPEG, PNG, GIF, or WebP.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setErrorMsg(`"${f.name}" exceeds the 5MB size limit.`);
        return;
      }
    }

    setErrorMsg('');
    setFiles(combined);

    // Generate previews
    const newPreviews: string[] = [];
    combined.forEach(f => {
      const url = URL.createObjectURL(f);
      newPreviews.push(url);
    });
    // Revoke old preview URLs
    previews.forEach(url => URL.revokeObjectURL(url));
    setPreviews(newPreviews);

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFiles(f => f.filter((_, i) => i !== index));
    setPreviews(p => p.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const titleErr = validate('title', form.title);
    const descErr = validate('description', form.description);
    const emailErr = validate('submitted_by_email', form.submitted_by_email);

    if (titleErr || descErr || emailErr) {
      setFieldErrors({
        title: titleErr || '',
        description: descErr || '',
        submitted_by_email: emailErr || '',
      });
      setTouched({ title: true, description: true, submitted_by_email: true });
      setStatus('idle');
      return;
    }

    try {
      const fd = new FormData();
      fd.append('type', form.type);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('submitted_by_name', form.submitted_by_name);
      fd.append('submitted_by_email', form.submitted_by_email);
      fd.append('submitted_by_phone', form.submitted_by_phone);
      fd.append('honeypot', form.honeypot);
      files.forEach(f => fd.append('images', f));

      const res = await fetch('/api/submit', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Something went wrong.');
      }
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h3 className="mb-2 text-xl font-semibold">Thank you!</h3>
          <p className="text-sm text-gray-400">
            Your request has been submitted and our team will review it shortly. We appreciate your feedback!
          </p>
          <button
            onClick={() => {
              setStatus('idle');
              setForm({ type: 'feature', title: '', description: '', submitted_by_name: '', submitted_by_email: '', submitted_by_phone: '', honeypot: '' });
              setFiles([]);
              previews.forEach(url => URL.revokeObjectURL(url));
              setPreviews([]);
              setFieldErrors({});
              setTouched({});
            }}
            className="mt-6 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  const typeOptions: { value: RequestType; label: string; desc: string }[] = [
    { value: 'bug', label: 'Bug Report', desc: "Something isn't working correctly" },
    { value: 'feature', label: 'Feature Request', desc: 'A new capability or feature' },
    { value: 'improvement', label: 'Improvement', desc: 'Enhance something that already exists' },
  ];

  const inputCls = (field: string) =>
    `w-full rounded-lg border px-4 py-2.5 text-sm bg-gray-900 placeholder:text-gray-600 focus:outline-none focus:ring-1 transition-colors ${
      touched[field] && fieldErrors[field]
        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-700 focus:border-blue-500 focus:ring-blue-500'
    }`;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1v6M5 4l3 3 3-3" />
              <rect x="2" y="9" width="12" height="5" rx="1" />
            </svg>
            RoofingLogic Task Tracker
          </div>
          <h1 className="mb-2 text-2xl font-bold">Submit a Request</h1>
          <p className="text-sm text-gray-400">
            Report a bug, request a feature, or suggest an improvement.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
          {/* Honeypot */}
          <input
            type="text"
            name="website"
            value={form.honeypot}
            onChange={e => setForm(f => ({ ...f, honeypot: e.target.value }))}
            tabIndex={-1}
            autoComplete="off"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />

          {/* Type selector */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Request Type <span className="text-red-400">*</span>
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {typeOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    form.type === opt.value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="mt-0.5 text-xs opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="fr-title" className="mb-1.5 block text-sm font-medium">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="fr-title"
              type="text"
              required
              value={form.title}
              onChange={e => {
                setForm(f => ({ ...f, title: e.target.value }));
                if (touched.title) setFieldErrors(p => ({ ...p, title: validate('title', e.target.value) || '' }));
              }}
              onBlur={() => handleBlur('title')}
              placeholder="Brief summary of your request"
              className={inputCls('title')}
            />
            {touched.title && fieldErrors.title && (
              <p className="mt-1 text-sm text-red-400">{fieldErrors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="fr-desc" className="mb-1.5 block text-sm font-medium">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="fr-desc"
              required
              rows={5}
              value={form.description}
              onChange={e => {
                setForm(f => ({ ...f, description: e.target.value }));
                if (touched.description) setFieldErrors(p => ({ ...p, description: validate('description', e.target.value) || '' }));
              }}
              onBlur={() => handleBlur('description')}
              placeholder="Describe the issue or request in detail. Include steps to reproduce for bugs, or expected behavior for features."
              className={`${inputCls('description')} resize-none`}
            />
            {touched.description && fieldErrors.description && (
              <p className="mt-1 text-sm text-red-400">{fieldErrors.description}</p>
            )}
          </div>

          {/* Image upload */}
          <div>
            <p className="mb-2 text-sm font-medium">
              Screenshots <span className="text-xs text-gray-500">(optional, up to 3 images, 5MB each)</span>
            </p>

            {/* Preview thumbnails */}
            {previews.length > 0 && (
              <div className="mb-3 flex gap-3">
                {previews.map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url}
                      alt={`Preview ${i + 1}`}
                      className="h-20 w-20 rounded-lg border border-gray-700 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length < MAX_FILES && (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-700 px-4 py-4 text-sm text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                {files.length === 0 ? 'Add screenshots' : `Add more (${files.length}/${MAX_FILES})`}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleFiles}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Contact info */}
          <div>
            <p className="mb-3 text-sm font-medium">
              Contact Info <span className="text-xs text-gray-500">(optional, for follow-up)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="fr-name" className="mb-1 block text-xs text-gray-500">Name</label>
                <input
                  id="fr-name"
                  type="text"
                  value={form.submitted_by_name}
                  onChange={e => setForm(f => ({ ...f, submitted_by_name: e.target.value }))}
                  placeholder="Your name"
                  className={inputCls('submitted_by_name')}
                />
              </div>
              <div>
                <label htmlFor="fr-email" className="mb-1 block text-xs text-gray-500">Email</label>
                <input
                  id="fr-email"
                  type="email"
                  value={form.submitted_by_email}
                  onChange={e => {
                    setForm(f => ({ ...f, submitted_by_email: e.target.value }));
                    if (touched.submitted_by_email) setFieldErrors(p => ({ ...p, submitted_by_email: validate('submitted_by_email', e.target.value) || '' }));
                  }}
                  onBlur={() => handleBlur('submitted_by_email')}
                  placeholder="you@example.com"
                  className={inputCls('submitted_by_email')}
                />
                {touched.submitted_by_email && fieldErrors.submitted_by_email && (
                  <p className="mt-1 text-sm text-red-400">{fieldErrors.submitted_by_email}</p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor="fr-phone" className="mb-1 block text-xs text-gray-500">Phone</label>
              <input
                id="fr-phone"
                type="tel"
                value={form.submitted_by_phone}
                onChange={e => setForm(f => ({ ...f, submitted_by_phone: e.target.value }))}
                placeholder="(555) 123-4567"
                className={inputCls('submitted_by_phone')}
              />
            </div>
          </div>

          {/* Error banner */}
          {status === 'error' && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{errorMsg}</p>
            </div>
          )}
          {errorMsg && status !== 'error' && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{errorMsg}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                Uploading...
              </span>
            ) : (
              'Submit Request'
            )}
          </button>

          <p className="text-center text-xs text-gray-500">
            Your request will be reviewed by our dev team.
          </p>
        </form>
      </div>
    </div>
  );
}
