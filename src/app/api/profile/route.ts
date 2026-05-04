import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';
import type { Profile } from '@/types';

export async function GET(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await query<Profile>(
    `SELECT * FROM profiles WHERE user_id = $1`,
    [auth.userId],
  );
  return NextResponse.json({ profile: profile[0] });
}

export async function PATCH(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { school, major, graduation_year, target_cities, internship_types, internship_type } = body;
  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (school !== undefined) { updates.push(`school = $${idx++}`); params.push(school || null); }
  if (major !== undefined) { updates.push(`major = $${idx++}`); params.push(major || null); }
  if (graduation_year !== undefined) {
    const year = graduation_year ? parseInt(String(graduation_year), 10) : null;
    updates.push(`graduation_year = $${idx++}`);
    params.push(year);
  }
  if (target_cities !== undefined) {
    const cities = typeof target_cities === 'string'
      ? target_cities.split(',').map((c: string) => c.trim()).filter(Boolean)
      : target_cities;
    updates.push(`target_cities = $${idx++}`);
    params.push(cities);
  }
  if (internship_types !== undefined) {
    updates.push(`internship_types = $${idx++}`);
    params.push(Array.isArray(internship_types) ? internship_types : []);
  } else if (internship_type !== undefined) {
    updates.push(`internship_types = $${idx++}`);
    params.push(internship_type ? [internship_type] : []);
  }
  if (updates.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }
  updates.push(`updated_at = NOW()`);
  params.push(auth.userId);

  await execute(
    `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $${idx}`,
    params,
  );
  return NextResponse.json({ success: true });
}
