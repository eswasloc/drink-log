import { getDatabase, getImagesBucket, readSession, type AppEnv } from "./auth";

type DrinkProfile =
  | "whisky"
  | "sake"
  | "gin"
  | "rum"
  | "korean_traditional"
  | "wine";

type FlavorEntry = {
  flavor: string;
  intensity: number;
  valence: "positive" | "neutral" | "negative";
  category: "sweet" | "floral" | "spice" | "wood" | "smoke" | "texture";
};

type Bottle = {
  id: string;
  name: string;
  type: DrinkProfile;
  brand: string;
  abv: number | null;
  created_at: string;
};

type BottleImage = {
  id: string;
  bottle_id: string;
  image_key: string;
  thumbnail_key?: string;
  data_url: string;
  thumbnail_data_url?: string;
  mime_type: string;
  file_name: string;
  created_at: string;
};

type SensoryNote = {
  bottle_id: string;
  profile: DrinkProfile;
  sections: Record<string, FlavorEntry[]>;
  note: string;
};

export type TastingLogPayload = {
  id: string;
  bottle: Bottle;
  images: BottleImage[];
  sensory: SensoryNote;
  created_at: string;
};

type BottleRow = Bottle;

type ImageRow = {
  id: string;
  bottle_id: string;
  image_key: string;
  thumbnail_key: string | null;
  mime_type: string;
  file_name: string;
  created_at: string;
};

type SensoryRow = {
  bottle_id: string;
  profile: DrinkProfile;
  sections_json: string;
  note: string;
};

function json(data: unknown, init?: ResponseInit) {
  const response = Response.json(data, init);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function imageUrl(key: string) {
  return `/api/images?key=${encodeURIComponent(key)}`;
}

function parseDataUrl(value: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (!match) {
    return null;
  }

  const mimeType = match[1] || "application/octet-stream";
  const payload = match[3];
  if (match[2]) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { bytes, mimeType };
  }

  return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), mimeType };
}

function buildLog(bottle: BottleRow, images: ImageRow[], sensory?: SensoryRow): TastingLogPayload {
  return {
    id: bottle.id,
    bottle,
    images: images.map((image) => ({
      id: image.id,
      bottle_id: image.bottle_id,
      image_key: image.image_key,
      thumbnail_key: image.thumbnail_key ?? undefined,
      data_url: imageUrl(image.image_key),
      thumbnail_data_url: image.thumbnail_key ? imageUrl(image.thumbnail_key) : undefined,
      mime_type: image.mime_type,
      file_name: image.file_name,
      created_at: image.created_at,
    })),
    sensory: sensory
      ? {
          bottle_id: sensory.bottle_id,
          profile: sensory.profile,
          sections: JSON.parse(sensory.sections_json) as Record<string, FlavorEntry[]>,
          note: sensory.note,
        }
      : {
          bottle_id: bottle.id,
          profile: bottle.type,
          sections: {},
          note: "",
        },
    created_at: bottle.created_at,
  };
}

async function requireSession(
  request: Request,
  env: AppEnv,
): Promise<{ userId: string } | { response: Response }> {
  const session = await readSession(request, env);
  if (!session) {
    return { response: json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { userId: session.userId };
}

async function uploadImagePayload(env: AppEnv, image: BottleImage) {
  const bucket = getImagesBucket(env);
  const original = parseDataUrl(image.data_url);
  if (original) {
    await bucket.put(image.image_key, original.bytes, {
      httpMetadata: { contentType: image.mime_type || original.mimeType },
    });
  }

  if (image.thumbnail_key && image.thumbnail_data_url) {
    const thumbnail = parseDataUrl(image.thumbnail_data_url);
    if (thumbnail) {
      await bucket.put(image.thumbnail_key, thumbnail.bytes, {
        httpMetadata: { contentType: thumbnail.mimeType },
      });
    }
  }
}

async function loadRows(env: AppEnv, ownerId: string, bottleId?: string) {
  const db = getDatabase(env);
  const bottleWhere = bottleId ? "owner_id = ? AND id = ?" : "owner_id = ?";
  const bottleParams = bottleId ? [ownerId, bottleId] : [ownerId];
  const bottles = await db
    .prepare(`SELECT id, name, type, brand, abv, created_at FROM bottles WHERE ${bottleWhere} ORDER BY created_at DESC`)
    .bind(...bottleParams)
    .all<BottleRow>();

  const images = await db
    .prepare(
      bottleId
        ? "SELECT id, bottle_id, image_key, thumbnail_key, mime_type, file_name, created_at FROM bottle_images WHERE owner_id = ? AND bottle_id = ? ORDER BY created_at"
        : "SELECT id, bottle_id, image_key, thumbnail_key, mime_type, file_name, created_at FROM bottle_images WHERE owner_id = ? ORDER BY created_at",
    )
    .bind(...bottleParams)
    .all<ImageRow>();

  const sensory = await db
    .prepare(
      bottleId
        ? "SELECT bottle_id, profile, sections_json, note FROM sensory_notes WHERE owner_id = ? AND bottle_id = ?"
        : "SELECT bottle_id, profile, sections_json, note FROM sensory_notes WHERE owner_id = ?",
    )
    .bind(...bottleParams)
    .all<SensoryRow>();

  return {
    bottles: bottles.results,
    images: images.results,
    sensory: sensory.results,
  };
}

export async function listLogs(request: Request, env: AppEnv): Promise<Response> {
  const session = await requireSession(request, env);
  if ("response" in session) {
    return session.response;
  }

  const rows = await loadRows(env, session.userId);
  const imagesByBottleId = new Map<string, ImageRow[]>();
  rows.images.forEach((image) => {
    const group = imagesByBottleId.get(image.bottle_id) ?? [];
    group.push(image);
    imagesByBottleId.set(image.bottle_id, group);
  });
  const sensoryByBottleId = new Map(rows.sensory.map((note) => [note.bottle_id, note]));

  return json(
    rows.bottles.map((bottle) =>
      buildLog(bottle, imagesByBottleId.get(bottle.id) ?? [], sensoryByBottleId.get(bottle.id)),
    ),
  );
}

export async function getLog(request: Request, env: AppEnv, id: string): Promise<Response> {
  const session = await requireSession(request, env);
  if ("response" in session) {
    return session.response;
  }

  const rows = await loadRows(env, session.userId, id);
  const bottle = rows.bottles[0];
  if (!bottle) {
    return json({ error: "not_found" }, { status: 404 });
  }

  return json(buildLog(bottle, rows.images, rows.sensory[0]));
}

export async function createLog(request: Request, env: AppEnv): Promise<Response> {
  const session = await requireSession(request, env);
  if ("response" in session) {
    return session.response;
  }

  const log = (await request.json()) as TastingLogPayload;
  await saveLog(env, session.userId, log);
  return getLog(request, env, log.id);
}

export async function updateLog(
  request: Request,
  env: AppEnv,
  id: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if ("response" in session) {
    return session.response;
  }

  const existing = await getDatabase(env)
    .prepare("SELECT id FROM bottles WHERE owner_id = ? AND id = ?")
    .bind(session.userId, id)
    .first<{ id: string }>();

  if (!existing) {
    return json({ error: "not_found" }, { status: 404 });
  }

  const log = (await request.json()) as TastingLogPayload;
  await replaceLog(env, session.userId, { ...log, id, bottle: { ...log.bottle, id } });
  return getLog(request, env, id);
}

export async function deleteLog(request: Request, env: AppEnv, id: string): Promise<Response> {
  const session = await requireSession(request, env);
  if ("response" in session) {
    return session.response;
  }

  const db = getDatabase(env);
  const oldImages = await db
    .prepare("SELECT image_key, thumbnail_key FROM bottle_images WHERE owner_id = ? AND bottle_id = ?")
    .bind(session.userId, id)
    .all<{ image_key: string; thumbnail_key: string | null }>();

  await db.prepare("DELETE FROM bottles WHERE owner_id = ? AND id = ?").bind(session.userId, id).run();

  const bucket = getImagesBucket(env);
  await Promise.all(
    oldImages.results.flatMap((image) =>
      [image.image_key, image.thumbnail_key].filter(Boolean).map((key) => bucket.delete(String(key))),
    ),
  );

  return new Response(null, { status: 204 });
}

async function saveLog(env: AppEnv, ownerId: string, log: TastingLogPayload) {
  const db = getDatabase(env);
  await db
    .prepare("INSERT INTO bottles (id, owner_id, name, type, brand, abv, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(log.bottle.id, ownerId, log.bottle.name, log.bottle.type, log.bottle.brand, log.bottle.abv, log.bottle.created_at)
    .run();
  await saveLogParts(env, ownerId, log);
}

async function replaceLog(env: AppEnv, ownerId: string, log: TastingLogPayload) {
  const db = getDatabase(env);
  const oldImages = await db
    .prepare("SELECT id, image_key, thumbnail_key FROM bottle_images WHERE owner_id = ? AND bottle_id = ?")
    .bind(ownerId, log.id)
    .all<{ id: string; image_key: string; thumbnail_key: string | null }>();
  const nextImageIds = new Set(log.images.map((image) => image.id));
  const deletedImages = oldImages.results.filter((image) => !nextImageIds.has(image.id));

  await db
    .prepare("UPDATE bottles SET name = ?, type = ?, brand = ?, abv = ? WHERE owner_id = ? AND id = ?")
    .bind(log.bottle.name, log.bottle.type, log.bottle.brand, log.bottle.abv, ownerId, log.id)
    .run();
  await db.prepare("DELETE FROM bottle_images WHERE owner_id = ? AND bottle_id = ?").bind(ownerId, log.id).run();
  await saveLogParts(env, ownerId, log);

  const bucket = getImagesBucket(env);
  await Promise.all(
    deletedImages.flatMap((image) =>
      [image.image_key, image.thumbnail_key].filter(Boolean).map((key) => bucket.delete(String(key))),
    ),
  );
}

async function saveLogParts(env: AppEnv, ownerId: string, log: TastingLogPayload) {
  const db = getDatabase(env);
  await db
    .prepare(
      `INSERT INTO sensory_notes (bottle_id, owner_id, profile, sections_json, note)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(bottle_id) DO UPDATE SET
        profile = excluded.profile,
        sections_json = excluded.sections_json,
        note = excluded.note`,
    )
    .bind(log.id, ownerId, log.sensory.profile, JSON.stringify(log.sensory.sections), log.sensory.note)
    .run();

  for (const image of log.images) {
    await uploadImagePayload(env, image);
    await db
      .prepare(
        `INSERT INTO bottle_images (
          id, bottle_id, owner_id, image_key, thumbnail_key, mime_type, file_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        image.id,
        log.id,
        ownerId,
        image.image_key,
        image.thumbnail_key ?? null,
        image.mime_type,
        image.file_name,
        image.created_at,
      )
      .run();
  }
}
