import { getDatabase, readSession, type AppEnv } from "../../_shared/auth";

type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type LatestBottleRow = {
  id: string;
  name: string;
  created_at: string;
};

export const onRequestGet: PagesFunction<AppEnv> = async ({ env, request }) => {
  const session = await readSession(request, env);
  if (!session) {
    return Response.json(
      { authenticated: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = getDatabase(env);
  const [user, bottleCount, imageCount, sensoryCount, latestBottles] = await Promise.all([
    db
      .prepare("SELECT id, email, display_name FROM users WHERE id = ?")
      .bind(session.userId)
      .first<UserRow>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM bottles WHERE owner_id = ?")
      .bind(session.userId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM bottle_images WHERE owner_id = ?")
      .bind(session.userId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM sensory_notes WHERE owner_id = ?")
      .bind(session.userId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT id, name, created_at FROM bottles WHERE owner_id = ? ORDER BY created_at DESC LIMIT 5",
      )
      .bind(session.userId)
      .all<LatestBottleRow>(),
  ]);

  return Response.json(
    {
      authenticated: true,
      user,
      counts: {
        bottles: bottleCount?.count ?? 0,
        images: imageCount?.count ?? 0,
        sensoryNotes: sensoryCount?.count ?? 0,
      },
      latestBottles: latestBottles.results,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
};
