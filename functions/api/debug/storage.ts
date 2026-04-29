import { getDatabase, readSession, type AppEnv } from "../../_shared/auth";

type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type LatestSakeRecordRow = {
  id: string;
  name: string;
  consumed_date: string;
  created_at: string;
};

export const onRequestGet: PagesFunction<AppEnv> = async ({ env, request }) => {
  const noStoreHeaders = {
    "Cache-Control": "no-store",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
  };

  const session = await readSession(request, env);
  if (!session) {
    return Response.json(
      { authenticated: false },
      { headers: noStoreHeaders },
    );
  }

  const db = getDatabase(env);
  const [
    user,
    sakeRecordCount,
    sakeImageCount,
    tagCount,
    recordTagCount,
    latestSakeRecords,
  ] = await Promise.all([
    db
      .prepare("SELECT id, email, display_name FROM users WHERE id = ?")
      .bind(session.userId)
      .first<UserRow>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM sake_records WHERE owner_id = ?")
      .bind(session.userId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM sake_images WHERE owner_id = ?")
      .bind(session.userId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM tags WHERE drink_type = 'sake' AND (owner_id IS NULL OR owner_id = ?)")
      .bind(session.userId)
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM record_tags rt
         JOIN sake_records record ON record.id = rt.record_id
         WHERE record.owner_id = ?`,
      )
      .bind(session.userId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT id, name, consumed_date, created_at FROM sake_records WHERE owner_id = ? ORDER BY consumed_date DESC, created_at DESC LIMIT 5",
      )
      .bind(session.userId)
      .all<LatestSakeRecordRow>(),
  ]);

  return Response.json(
    {
      authenticated: true,
      user,
      counts: {
        sakeRecords: sakeRecordCount?.count ?? 0,
        sakeImages: sakeImageCount?.count ?? 0,
        sakeTags: tagCount?.count ?? 0,
        sakeRecordTags: recordTagCount?.count ?? 0,
      },
      latestSakeRecords: latestSakeRecords.results,
    },
    { headers: noStoreHeaders },
  );
};
