import { NextRequest, NextResponse } from 'next/server';
import { ApplicationTracker } from '@/server/application';
import type { ApplicationStatus } from '@/types';

const DEFAULT_PROFILE_ID = 1;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json();
  const { status } = body as { status?: ApplicationStatus };

  if (!status) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  const tracker = new ApplicationTracker(DEFAULT_PROFILE_ID);
  try {
    const event = await tracker.updateStatus(id, status, 'manual');
    return NextResponse.json(event);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const tracker = new ApplicationTracker(DEFAULT_PROFILE_ID);
  const events = await tracker.getEvents(id);
  return NextResponse.json({ events });
}
