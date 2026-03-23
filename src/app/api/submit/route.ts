import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// GET /api/submit — list all submissions (for internal review)
export async function GET(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const status = req.nextUrl.searchParams.get('status');

    let query = sb
      .from('feature_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// POST /api/submit — public submission with optional image uploads
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const type = formData.get('type') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const submitted_by_name = formData.get('submitted_by_name') as string;
    const submitted_by_email = formData.get('submitted_by_email') as string;
    const submitted_by_phone = formData.get('submitted_by_phone') as string;
    const honeypot = formData.get('honeypot') as string;

    // Validate required fields
    if (!type || !['bug', 'feature', 'improvement'].includes(type)) {
      return NextResponse.json({ error: 'Valid type is required (bug, feature, improvement)' }, { status: 400 });
    }
    if (!title?.trim() || title.trim().length < 5) {
      return NextResponse.json({ error: 'Title must be at least 5 characters' }, { status: 400 });
    }
    if (!description?.trim() || description.trim().length < 20) {
      return NextResponse.json({ error: 'Description must be at least 20 characters' }, { status: 400 });
    }

    // Honeypot check
    if (honeypot) {
      return NextResponse.json({ success: true });
    }

    // Email format check
    if (submitted_by_email?.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitted_by_email.trim())) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }
    }

    const sb = getSupabaseAdmin();

    // Handle image uploads
    const files = formData.getAll('images') as File[];
    const imageUrls: string[] = [];

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} images allowed` }, { status: 400 });
    }

    const submissionId = crypto.randomUUID();

    for (const file of files) {
      if (!file.size) continue; // skip empty file inputs

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Invalid file type: ${file.type}. Only JPEG, PNG, GIF, and WebP are allowed.` }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File "${file.name}" exceeds 5MB limit` }, { status: 400 });
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${submissionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadErr } = await sb.storage
        .from('submission-images')
        .upload(path, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadErr) {
        console.error('Upload error:', uploadErr);
        return NextResponse.json({ error: 'Failed to upload image. Please try again.' }, { status: 500 });
      }

      const { data: urlData } = sb.storage
        .from('submission-images')
        .getPublicUrl(path);

      imageUrls.push(urlData.publicUrl);
    }

    // Insert submission
    const { data, error } = await sb
      .from('feature_submissions')
      .insert({
        type,
        title: title.trim(),
        description: description.trim(),
        submitted_by_name: submitted_by_name?.trim() || null,
        submitted_by_email: submitted_by_email?.trim() || null,
        submitted_by_phone: submitted_by_phone?.trim() || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        status: 'new',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save submission:', error);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error('Submit error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong' },
      { status: 500 }
    );
  }
}

// PUT /api/submit — update submission status (for internal review)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const updates: Record<string, unknown> = {};

    if (body.status) {
      if (!['new', 'reviewed', 'accepted', 'declined'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = body.status;
      if (body.status !== 'new' && !updates.reviewed_at) {
        updates.reviewed_at = new Date().toISOString();
      }
    }

    if (body.linked_task_id !== undefined) {
      updates.linked_task_id = body.linked_task_id || null;
    }

    const { data, error } = await sb
      .from('feature_submissions')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
