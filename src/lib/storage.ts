import type {
  Bottle,
  BottleImage,
  DrinkProfile,
  FlavorEntry,
  SensoryNote,
  TastingLog,
} from "../types/models";
import { DEFAULT_SAKE_TAGS } from "../constants/defaultTags";
import { sortNegativeLast } from "../data/flavors";
import { PROFILE_SECTIONS } from "../data/profiles";
import type {
  SakeDraft,
  SakeImage,
  SakeRecord,
  SakeRecordEntry,
  SakeRecordTag,
  SakeTag,
  SakeTagGroup,
} from "../types/sake";

const DB_NAME = "alcohol-log-db";
const DB_VERSION = 3;
const BOTTLES_STORE = "bottles";
const IMAGES_STORE = "images";
const SENSORY_NOTES_STORE = "sensory_notes";
const LEGACY_LOGS_STORE = "logs";
const SAKE_RECORDS_STORE = "sake_records";
const SAKE_IMAGES_STORE = "sake_images";
const SAKE_TAGS_STORE = "tags";
const SAKE_RECORD_TAGS_STORE = "record_tags";
const CLOUD_LOGS_PATH = "/api/cloud/logs";
const CLOUD_LOG_PATH = "/api/cloud/log";
const CLOUD_IMAGE_SRC_PREFIX = "/api/images?key=";
const CLOUD_SAKE_RECORDS_PATH = "/api/sake-records";
const CLOUD_TAGS_PATH = "/api/tags?drink_type=sake";
const LOCAL_OWNER_ID = "local";
const MAX_CUSTOM_TAG_LABEL_LENGTH = 20;

let cloudStorageEnabled = false;
let defaultSakeTagsSeeded = false;

export class CloudStorageError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CloudStorageError";
    this.status = status;
  }
}

export interface DraftEntry {
  bottleName: string;
  brand: string;
  abv: string;
  profile: DrinkProfile;
  sectionId: string;
  sectionSelections: Record<string, FlavorEntry[]>;
  note: string;
  images: BottleImage[];
}

export function setCloudStorageEnabled(enabled: boolean) {
  cloudStorageEnabled = enabled;
}

export function createInitialDraft(): DraftEntry {
  const profile: DrinkProfile = "whisky";
  const sectionSelections = PROFILE_SECTIONS[profile].reduce<
    Record<string, FlavorEntry[]>
  >((acc, section) => {
    acc[section.id] = [];
    return acc;
  }, {});

  return {
    bottleName: "",
    brand: "",
    abv: "",
    profile,
    sectionId: PROFILE_SECTIONS[profile][0].id,
    sectionSelections,
    note: "",
    images: [],
  };
}

export function createDraftFromLog(log: TastingLog): DraftEntry {
  const sectionSelections = createEmptySectionSelections(log.sensory.profile);

  Object.entries(log.sensory.sections).forEach(([sectionId, entries]) => {
    sectionSelections[sectionId] = sortNegativeLast(entries);
  });

  return {
    bottleName: log.bottle.name,
    brand: log.bottle.brand,
    abv: log.bottle.abv === null ? "" : String(log.bottle.abv),
    profile: log.sensory.profile,
    sectionId: PROFILE_SECTIONS[log.sensory.profile][0].id,
    sectionSelections,
    note: log.sensory.note,
    images: log.images,
  };
}

function sortSectionSelections(sections: Record<string, FlavorEntry[]>) {
  return Object.fromEntries(
    Object.entries(sections).map(([sectionId, entries]) => [
      sectionId,
      sortNegativeLast(entries),
    ]),
  );
}

async function cloudRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const requestPath =
    method === "GET"
      ? `${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`
      : path;

  const response = await fetch(requestPath, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new CloudStorageError(
      response.status,
      `Cloud storage request failed: ${response.status}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function getImageExtension(image: BottleImage) {
  const fileExtension = image.file_name.split(".").pop();
  if (fileExtension) {
    return fileExtension;
  }

  return image.mime_type.split("/").pop() || "jpg";
}

function ensureImageKeys(image: BottleImage, bottleId: string) {
  const imagePathPrefix = `images/${bottleId}`;
  const thumbnailPathPrefix = `thumbnails/${bottleId}`;
  const extension = getImageExtension(image);
  const imageKey =
    image.image_key.startsWith(imagePathPrefix) || image.data_url.startsWith(CLOUD_IMAGE_SRC_PREFIX)
      ? image.image_key
      : `${imagePathPrefix}/${image.id}.${extension}`;

  return {
    ...image,
    bottle_id: bottleId,
    image_key: imageKey,
    thumbnail_key: image.thumbnail_key ?? `${thumbnailPathPrefix}/${image.id}.webp`,
  };
}

function buildEntryFromDraft(
  draft: DraftEntry,
  bottleId: string,
  createdAt: string,
): TastingLog {
  const bottle: Bottle = {
    id: bottleId,
    name: draft.bottleName.trim(),
    type: draft.profile,
    brand: draft.brand.trim(),
    abv: draft.abv ? Number(draft.abv) : null,
    created_at: createdAt,
  };

  const sensory: SensoryNote = {
    bottle_id: bottle.id,
    profile: draft.profile,
    sections: sortSectionSelections(draft.sectionSelections),
    note: draft.note.trim(),
  };

  const images = draft.images.map((image) => ensureImageKeys(image, bottle.id));

  return {
    id: bottle.id,
    bottle,
    images,
    sensory,
    created_at: createdAt,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      const transaction = request.transaction;

      if (!db.objectStoreNames.contains(BOTTLES_STORE)) {
        const store = db.createObjectStore(BOTTLES_STORE, { keyPath: "id" });
        store.createIndex("created_at", "created_at", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }

      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const store = db.createObjectStore(IMAGES_STORE, { keyPath: "id" });
        store.createIndex("bottle_id", "bottle_id", { unique: false });
        store.createIndex("created_at", "created_at", { unique: false });
      }

      if (!db.objectStoreNames.contains(SENSORY_NOTES_STORE)) {
        const store = db.createObjectStore(SENSORY_NOTES_STORE, {
          keyPath: "bottle_id",
        });
        store.createIndex("profile", "profile", { unique: false });
      }

      if (!db.objectStoreNames.contains(SAKE_RECORDS_STORE)) {
        const store = db.createObjectStore(SAKE_RECORDS_STORE, { keyPath: "id" });
        store.createIndex("owner_id", "owner_id", { unique: false });
        store.createIndex("drink_type", "drink_type", { unique: false });
        store.createIndex("consumed_date", "consumed_date", { unique: false });
        store.createIndex("updated_at", "updated_at", { unique: false });
      }

      if (!db.objectStoreNames.contains(SAKE_IMAGES_STORE)) {
        const store = db.createObjectStore(SAKE_IMAGES_STORE, { keyPath: "id" });
        store.createIndex("owner_id", "owner_id", { unique: false });
        store.createIndex("record_id", "record_id", { unique: false });
        store.createIndex("display_order", "display_order", { unique: false });
      }

      if (!db.objectStoreNames.contains(SAKE_TAGS_STORE)) {
        const store = db.createObjectStore(SAKE_TAGS_STORE, { keyPath: "id" });
        store.createIndex("owner_id", "owner_id", { unique: false });
        store.createIndex("drink_type", "drink_type", { unique: false });
        store.createIndex("tag_group", "tag_group", { unique: false });
        store.createIndex("drink_type_tag_group", ["drink_type", "tag_group"], {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains(SAKE_RECORD_TAGS_STORE)) {
        const store = db.createObjectStore(SAKE_RECORD_TAGS_STORE, {
          keyPath: ["record_id", "tag_id"],
        });
        store.createIndex("record_id", "record_id", { unique: false });
        store.createIndex("tag_id", "tag_id", { unique: false });
      }

      if (transaction && db.objectStoreNames.contains(SAKE_TAGS_STORE)) {
        const tagsStore = transaction.objectStore(SAKE_TAGS_STORE);
        putMissingDefaultSakeTags(tagsStore, [], new Date().toISOString());
      }

      if (
        transaction &&
        db.objectStoreNames.contains(LEGACY_LOGS_STORE) &&
        db.objectStoreNames.contains(BOTTLES_STORE) &&
        db.objectStoreNames.contains(IMAGES_STORE) &&
        db.objectStoreNames.contains(SENSORY_NOTES_STORE)
      ) {
        const legacyStore = transaction.objectStore(LEGACY_LOGS_STORE);
        const legacyRequest = legacyStore.getAll();

        legacyRequest.onsuccess = () => {
          const legacyLogs = (legacyRequest.result as TastingLog[]) ?? [];
          const bottlesStore = transaction.objectStore(BOTTLES_STORE);
          const imagesStore = transaction.objectStore(IMAGES_STORE);
          const sensoryStore = transaction.objectStore(SENSORY_NOTES_STORE);

          legacyLogs.forEach((log) => {
            bottlesStore.put(log.bottle);
            sensoryStore.put(log.sensory);
            log.images.forEach((image) => imagesStore.put(image));
          });

          db.deleteObjectStore(LEGACY_LOGS_STORE);
        };
      }
    };
  });
}

function withStores<T>(
  mode: IDBTransactionMode,
  storeNames: string[],
  action: (
    stores: Record<string, IDBObjectStore>,
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void,
  ) => void,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeNames, mode);
        const stores = Object.fromEntries(
          storeNames.map((storeName) => [storeName, transaction.objectStore(storeName)]),
        );

        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => db.close();

        action(stores, resolve, reject);
      }),
  );
}

function getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as T[]) ?? []);
  });
}

function getByKey<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T | undefined);
  });
}

function getAllByIndex<T>(
  store: IDBObjectStore,
  indexName: string,
  key: string,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.index(indexName).getAll(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as T[]) ?? []);
  });
}

function buildLog(
  bottle: Bottle,
  images: BottleImage[],
  sensory: SensoryNote | undefined,
): TastingLog {
  return {
    id: bottle.id,
    bottle,
    images: images.sort((left, right) => left.created_at.localeCompare(right.created_at)),
    sensory:
      sensory ??
      ({
        bottle_id: bottle.id,
        profile: bottle.type,
        sections: createEmptySectionSelections(bottle.type),
        note: "",
      } satisfies SensoryNote),
    created_at: bottle.created_at,
  };
}

export async function loadLogs(): Promise<TastingLog[]> {
  if (cloudStorageEnabled) {
    return cloudRequest<TastingLog[]>(CLOUD_LOGS_PATH);
  }

  return loadLocalLogs();
}

export async function loadLocalLogs(): Promise<TastingLog[]> {
  return withStores<TastingLog[]>(
    "readonly",
    [BOTTLES_STORE, IMAGES_STORE, SENSORY_NOTES_STORE],
    async (stores, resolve, reject) => {
      try {
        const [bottles, images, sensoryNotes] = await Promise.all([
          getAllFromStore<Bottle>(stores[BOTTLES_STORE]),
          getAllFromStore<BottleImage>(stores[IMAGES_STORE]),
          getAllFromStore<SensoryNote>(stores[SENSORY_NOTES_STORE]),
        ]);

        const imagesByBottleId = new Map<string, BottleImage[]>();
        images.forEach((image) => {
          const group = imagesByBottleId.get(image.bottle_id) ?? [];
          group.push(image);
          imagesByBottleId.set(image.bottle_id, group);
        });

        const sensoryByBottleId = new Map(
          sensoryNotes.map((note) => [note.bottle_id, note]),
        );

        const logs = bottles
          .map((bottle) =>
            buildLog(
              bottle,
              imagesByBottleId.get(bottle.id) ?? [],
              sensoryByBottleId.get(bottle.id),
            ),
          )
          .sort((left, right) => right.created_at.localeCompare(left.created_at));

        resolve(logs);
      } catch (error) {
        reject(error);
      }
    },
  );
}

export async function getLogById(id: string): Promise<TastingLog | undefined> {
  if (cloudStorageEnabled) {
    try {
      return await cloudRequest<TastingLog>(
        `${CLOUD_LOG_PATH}?id=${encodeURIComponent(id)}`,
      );
    } catch (error) {
      if (error instanceof CloudStorageError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  return getLocalLogById(id);
}

async function getLocalLogById(id: string): Promise<TastingLog | undefined> {
  return withStores<TastingLog | undefined>(
    "readonly",
    [BOTTLES_STORE, IMAGES_STORE, SENSORY_NOTES_STORE],
    async (stores, resolve, reject) => {
      try {
        const bottle = await getByKey<Bottle>(stores[BOTTLES_STORE], id);
        if (!bottle) {
          resolve(undefined);
          return;
        }

        const [images, sensory] = await Promise.all([
          getAllByIndex<BottleImage>(stores[IMAGES_STORE], "bottle_id", bottle.id),
          getByKey<SensoryNote>(stores[SENSORY_NOTES_STORE], bottle.id),
        ]);

        resolve(buildLog(bottle, images, sensory));
      } catch (error) {
        reject(error);
      }
    },
  );
}

export async function uploadLocalLogsToCloud(logs: TastingLog[]) {
  for (const log of logs) {
    const cloudLog: TastingLog = {
      ...log,
      images: log.images.map((image) => ensureImageKeys(image, log.id)),
    };

    try {
      await cloudRequest<TastingLog>(
        `${CLOUD_LOG_PATH}?id=${encodeURIComponent(cloudLog.id)}`,
      );
    } catch (error) {
      if (error instanceof CloudStorageError && error.status === 404) {
        await cloudRequest<TastingLog>(CLOUD_LOGS_PATH, {
          method: "POST",
          body: JSON.stringify(cloudLog),
        });
        continue;
      }
      throw error;
    }
  }
}

export async function saveLog(draft: DraftEntry): Promise<TastingLog> {
  const now = new Date().toISOString();
  const bottleId = crypto.randomUUID();
  const entry = buildEntryFromDraft(draft, bottleId, now);

  if (cloudStorageEnabled) {
    return cloudRequest<TastingLog>(CLOUD_LOGS_PATH, {
      method: "POST",
      body: JSON.stringify(entry),
    });
  }

  const { bottle, images, sensory } = entry;

  return withStores<TastingLog>(
    "readwrite",
    [BOTTLES_STORE, IMAGES_STORE, SENSORY_NOTES_STORE],
    (stores, resolve, reject) => {
      const bottleRequest = stores[BOTTLES_STORE].put(bottle);
      bottleRequest.onerror = () => reject(bottleRequest.error);

      const sensoryRequest = stores[SENSORY_NOTES_STORE].put(sensory);
      sensoryRequest.onerror = () => reject(sensoryRequest.error);

      images.forEach((image) => {
        const imageRequest = stores[IMAGES_STORE].put(image);
        imageRequest.onerror = () => reject(imageRequest.error);
      });

      resolve(entry);
    },
  );
}

export async function updateLog(id: string, draft: DraftEntry): Promise<TastingLog> {
  if (cloudStorageEnabled) {
    const existing = await getLogById(id);
    if (!existing) {
      throw new Error("Log not found");
    }
    const entry = buildEntryFromDraft(draft, id, existing.created_at);
    return cloudRequest<TastingLog>(`${CLOUD_LOG_PATH}?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(entry),
    });
  }

  return withStores<TastingLog>(
    "readwrite",
    [BOTTLES_STORE, IMAGES_STORE, SENSORY_NOTES_STORE],
    async (stores, resolve, reject) => {
      try {
        const existingBottle = await getByKey<Bottle>(stores[BOTTLES_STORE], id);
        if (!existingBottle) {
          reject(new Error("Log not found"));
          return;
        }

        const existingImages = await getAllByIndex<BottleImage>(
          stores[IMAGES_STORE],
          "bottle_id",
          id,
        );
        const createdAt = existingBottle.created_at;

        const bottle: Bottle = {
          id,
          name: draft.bottleName.trim(),
          type: draft.profile,
          brand: draft.brand.trim(),
          abv: draft.abv ? Number(draft.abv) : null,
          created_at: createdAt,
        };

        const sensory: SensoryNote = {
          bottle_id: id,
          profile: draft.profile,
          sections: sortSectionSelections(draft.sectionSelections),
          note: draft.note.trim(),
        };

        const images = draft.images.map((image) => ensureImageKeys(image, id));

        const keepImageIds = new Set(images.map((image) => image.id));
        existingImages
          .filter((image) => !keepImageIds.has(image.id))
          .forEach((image) => {
            const request = stores[IMAGES_STORE].delete(image.id);
            request.onerror = () => reject(request.error);
          });

        const bottleRequest = stores[BOTTLES_STORE].put(bottle);
        bottleRequest.onerror = () => reject(bottleRequest.error);

        const sensoryRequest = stores[SENSORY_NOTES_STORE].put(sensory);
        sensoryRequest.onerror = () => reject(sensoryRequest.error);

        images.forEach((image) => {
          const imageRequest = stores[IMAGES_STORE].put(image);
          imageRequest.onerror = () => reject(imageRequest.error);
        });

        resolve({
          id,
          bottle,
          images,
          sensory,
          created_at: createdAt,
        });
      } catch (error) {
        reject(error);
      }
    },
  );
}

export async function deleteLog(id: string): Promise<void> {
  if (cloudStorageEnabled) {
    await cloudRequest<void>(`${CLOUD_LOG_PATH}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }

  return withStores<void>(
    "readwrite",
    [BOTTLES_STORE, IMAGES_STORE, SENSORY_NOTES_STORE],
    async (stores, resolve, reject) => {
      try {
        const images = await getAllByIndex<BottleImage>(
          stores[IMAGES_STORE],
          "bottle_id",
          id,
        );

        images.forEach((image) => {
          const request = stores[IMAGES_STORE].delete(image.id);
          request.onerror = () => reject(request.error);
        });

        const bottleRequest = stores[BOTTLES_STORE].delete(id);
        bottleRequest.onerror = () => reject(bottleRequest.error);

        const sensoryRequest = stores[SENSORY_NOTES_STORE].delete(id);
        sensoryRequest.onerror = () => reject(sensoryRequest.error);

        resolve();
      } catch (error) {
        reject(error);
      }
    },
  );
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSelectedTagIds(tagIds: string[]) {
  return Array.from(new Set(tagIds.map((tagId) => tagId.trim()).filter(Boolean)));
}

function normalizeSakeTagLabelForCompare(label: string) {
  return label.trim().toLocaleLowerCase();
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function putMissingDefaultSakeTags(
  store: IDBObjectStore,
  existingTags: SakeTag[],
  createdAt: string,
) {
  const existingTagsById = new Map(existingTags.map((tag) => [tag.id, tag]));

  DEFAULT_SAKE_TAGS.forEach((tag) => {
    const existingTag = existingTagsById.get(tag.id);
    if (!existingTag) {
      store.put({
        ...tag,
        created_at: createdAt,
      } satisfies SakeTag);
      return;
    }

    if (
      existingTag.label !== tag.label ||
      existingTag.tag_group !== tag.tag_group ||
      existingTag.drink_type !== tag.drink_type ||
      existingTag.owner_id !== tag.owner_id ||
      !existingTag.is_default
    ) {
      store.put({
        ...existingTag,
        ...tag,
      } satisfies SakeTag);
    }
  });
}

function createSakeImageKey(ownerId: string, recordId: string, image: SakeDraft["images"][number]) {
  const extension = image.file_name.split(".").pop() || image.mime_type.split("/").pop() || "jpg";
  return `images/${ownerId}/sake/${recordId}/${image.id}.${extension}`;
}

function buildSakeEntryFromDraft(
  draft: SakeDraft,
  recordId: string,
  ownerId: string,
  createdAt: string,
  updatedAt: string,
  existingImagesById = new Map<string, SakeImage>(),
): { record: SakeRecord; images: SakeImage[]; recordTags: SakeRecordTag[] } {
  const name = draft.name.trim();
  if (!name) {
    throw new Error("Sake record name is required.");
  }

  const record: SakeRecord = {
    id: recordId,
    owner_id: ownerId,
    drink_type: "sake",
    name,
    region: normalizeOptionalText(draft.region),
    brewery: normalizeOptionalText(draft.brewery),
    rice: normalizeOptionalText(draft.rice),
    sake_type: normalizeOptionalText(draft.sake_type),
    sake_meter_value: normalizeOptionalText(draft.sake_meter_value),
    abv: normalizeOptionalText(draft.abv),
    volume: normalizeOptionalText(draft.volume),
    price: normalizeOptionalText(draft.price),
    drink_again: draft.drink_again,
    sweet_dry: draft.sweet_dry,
    aroma_intensity: draft.aroma_intensity,
    acidity: draft.acidity,
    clean_umami: draft.clean_umami,
    one_line_note: normalizeOptionalText(draft.one_line_note),
    place: normalizeOptionalText(draft.place),
    consumed_date: draft.consumed_date,
    companions: normalizeOptionalText(draft.companions),
    food_pairing: normalizeOptionalText(draft.food_pairing),
    created_at: createdAt,
    updated_at: updatedAt,
  };

  const images = draft.images.map((image, index) => {
    const existingImage = existingImagesById.get(image.id);

    return {
      id: image.id,
      owner_id: ownerId,
      record_id: recordId,
      image_key: existingImage?.image_key ?? createSakeImageKey(ownerId, recordId, image),
      thumbnail_key:
        existingImage?.thumbnail_key ?? `thumbnails/${ownerId}/sake/${recordId}/${image.id}.webp`,
      data_url: image.data_url,
      thumbnail_data_url: image.thumbnail_data_url ?? existingImage?.thumbnail_data_url ?? null,
      mime_type: image.mime_type,
      file_name: image.file_name,
      display_order: index,
      created_at: existingImage?.created_at ?? createdAt,
    };
  });

  const recordTags = normalizeSelectedTagIds(draft.selected_tag_ids).map((tagId) => ({
    record_id: recordId,
    tag_id: tagId,
    created_at: updatedAt,
  }));

  return { record, images, recordTags };
}

async function getAllSakeTagsFromStore(store: IDBObjectStore) {
  const tags = await requestToPromise<SakeTag[]>(store.getAll());
  return tags ?? [];
}

function sortSakeTags(tags: SakeTag[]) {
  const groupOrder: Record<SakeTagGroup, number> = { taste: 0, aroma: 1, mood: 2 };
  const defaultOrder = new Map(DEFAULT_SAKE_TAGS.map((tag, index) => [tag.id, index]));

  return [...tags].sort((left, right) => {
    const groupCompare = groupOrder[left.tag_group] - groupOrder[right.tag_group];
    if (groupCompare !== 0) {
      return groupCompare;
    }

    const leftDefaultOrder = defaultOrder.get(left.id);
    const rightDefaultOrder = defaultOrder.get(right.id);
    if (leftDefaultOrder !== undefined || rightDefaultOrder !== undefined) {
      return (leftDefaultOrder ?? Number.MAX_SAFE_INTEGER) - (rightDefaultOrder ?? Number.MAX_SAFE_INTEGER);
    }

    return left.created_at.localeCompare(right.created_at) || left.label.localeCompare(right.label);
  });
}

export async function seedSakeTagsIfNeeded(): Promise<void> {
  if (defaultSakeTagsSeeded) {
    return;
  }

  await withStores<void>(
    "readwrite",
    [SAKE_TAGS_STORE],
    async (stores, resolve, reject) => {
      try {
        const store = stores[SAKE_TAGS_STORE];
        const currentTags = await getAllSakeTagsFromStore(store);
        putMissingDefaultSakeTags(store, currentTags, new Date().toISOString());
        defaultSakeTagsSeeded = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    },
  );
}

export async function loadSakeTags(ownerId = LOCAL_OWNER_ID): Promise<SakeTag[]> {
  if (cloudStorageEnabled) {
    const tags = await cloudRequest<SakeTag[]>(CLOUD_TAGS_PATH);
    return sortSakeTags(tags.map((tag) => ({ ...tag, is_default: Boolean(tag.is_default) })));
  }

  await seedSakeTagsIfNeeded();

  return withStores<SakeTag[]>(
    "readonly",
    [SAKE_TAGS_STORE],
    async (stores, resolve, reject) => {
      try {
        const store = stores[SAKE_TAGS_STORE];
        const tags = await getAllSakeTagsFromStore(store);
        resolve(
          sortSakeTags(
            tags.filter(
              (tag) =>
                tag.drink_type === "sake" &&
                (tag.owner_id === null || tag.owner_id === ownerId),
            ),
          ),
        );
      } catch (error) {
        reject(error);
      }
    },
  );
}

export async function createCustomSakeTag(
  tagGroup: SakeTagGroup,
  label: string,
  ownerId = LOCAL_OWNER_ID,
): Promise<SakeTag | null> {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    return null;
  }

  const normalizedLabel = trimmedLabel.slice(0, MAX_CUSTOM_TAG_LABEL_LENGTH);
  const compareLabel = normalizeSakeTagLabelForCompare(normalizedLabel);

  if (cloudStorageEnabled) {
    const tag = await cloudRequest<SakeTag>(CLOUD_TAGS_PATH, {
      method: "POST",
      body: JSON.stringify({
        drink_type: "sake",
        tag_group: tagGroup,
        label: normalizedLabel,
      }),
    });
    return { ...tag, is_default: Boolean(tag.is_default) };
  }

  return withStores<SakeTag | null>(
    "readwrite",
    [SAKE_TAGS_STORE],
    async (stores, resolve, reject) => {
      try {
        const store = stores[SAKE_TAGS_STORE];
        const tags = await getAllSakeTagsFromStore(store);
        const existingTag = tags.find(
          (tag) =>
            tag.drink_type === "sake" &&
            tag.tag_group === tagGroup &&
            normalizeSakeTagLabelForCompare(tag.label) === compareLabel &&
            (tag.owner_id === null || tag.owner_id === ownerId),
        );

        if (existingTag) {
          resolve(existingTag);
          return;
        }

        const now = new Date().toISOString();
        const tag: SakeTag = {
          id: crypto.randomUUID(),
          owner_id: ownerId,
          drink_type: "sake",
          tag_group: tagGroup,
          label: normalizedLabel,
          is_default: false,
          created_at: now,
        };

        await requestToPromise(store.put(tag));
        resolve(tag);
      } catch (error) {
        reject(error);
      }
    },
  );
}

function buildSakeRecordEntry(
  record: SakeRecord,
  images: SakeImage[],
  recordTags: SakeRecordTag[],
  tags: SakeTag[],
): SakeRecordEntry {
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const selectedTags = recordTags
    .map((recordTag) => tagsById.get(recordTag.tag_id))
    .filter((tag): tag is SakeTag => Boolean(tag));

  return {
    id: record.id,
    record,
    images: [...images].sort((left, right) => left.display_order - right.display_order),
    tags: sortSakeTags(selectedTags),
    record_tags: recordTags,
  };
}

function normalizeCloudSakeEntry(entry: SakeRecordEntry): SakeRecordEntry {
  return {
    ...entry,
    tags: sortSakeTags(entry.tags.map((tag) => ({ ...tag, is_default: Boolean(tag.is_default) }))),
  };
}

function buildCloudSakePayload(
  draft: SakeDraft,
  recordId: string,
  createdAt: string,
  updatedAt: string,
) {
  const { record, images, recordTags } = buildSakeEntryFromDraft(
    draft,
    recordId,
    LOCAL_OWNER_ID,
    createdAt,
    updatedAt,
  );

  return { record, images, record_tags: recordTags };
}

export async function loadSakeRecords(ownerId = LOCAL_OWNER_ID): Promise<SakeRecordEntry[]> {
  if (cloudStorageEnabled) {
    const entries = await cloudRequest<SakeRecordEntry[]>(CLOUD_SAKE_RECORDS_PATH);
    return entries.map(normalizeCloudSakeEntry);
  }

  return withStores<SakeRecordEntry[]>(
    "readonly",
    [SAKE_RECORDS_STORE, SAKE_IMAGES_STORE, SAKE_RECORD_TAGS_STORE, SAKE_TAGS_STORE],
    async (stores, resolve, reject) => {
      try {
        const [records, images, recordTags, tags] = await Promise.all([
          getAllFromStore<SakeRecord>(stores[SAKE_RECORDS_STORE]),
          getAllFromStore<SakeImage>(stores[SAKE_IMAGES_STORE]),
          getAllFromStore<SakeRecordTag>(stores[SAKE_RECORD_TAGS_STORE]),
          getAllFromStore<SakeTag>(stores[SAKE_TAGS_STORE]),
        ]);

        const imagesByRecordId = new Map<string, SakeImage[]>();
        images.forEach((image) => {
          if (image.owner_id !== ownerId) {
            return;
          }
          const group = imagesByRecordId.get(image.record_id) ?? [];
          group.push(image);
          imagesByRecordId.set(image.record_id, group);
        });

        const recordTagsByRecordId = new Map<string, SakeRecordTag[]>();
        recordTags.forEach((recordTag) => {
          const group = recordTagsByRecordId.get(recordTag.record_id) ?? [];
          group.push(recordTag);
          recordTagsByRecordId.set(recordTag.record_id, group);
        });

        resolve(
          records
            .filter((record) => record.owner_id === ownerId && record.drink_type === "sake")
            .map((record) =>
              buildSakeRecordEntry(
                record,
                imagesByRecordId.get(record.id) ?? [],
                recordTagsByRecordId.get(record.id) ?? [],
                tags,
              ),
            )
            .sort((left, right) =>
              right.record.consumed_date.localeCompare(left.record.consumed_date) ||
              right.record.created_at.localeCompare(left.record.created_at),
            ),
        );
      } catch (error) {
        reject(error);
      }
    },
  );
}

export async function getSakeRecordById(
  id: string,
  ownerId = LOCAL_OWNER_ID,
): Promise<SakeRecordEntry | undefined> {
  if (cloudStorageEnabled) {
    try {
      const entry = await cloudRequest<SakeRecordEntry>(
        `${CLOUD_SAKE_RECORDS_PATH}/${encodeURIComponent(id)}`,
      );
      return normalizeCloudSakeEntry(entry);
    } catch (error) {
      if (error instanceof CloudStorageError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  return withStores<SakeRecordEntry | undefined>(
    "readonly",
    [SAKE_RECORDS_STORE, SAKE_IMAGES_STORE, SAKE_RECORD_TAGS_STORE, SAKE_TAGS_STORE],
    async (stores, resolve, reject) => {
      try {
        const record = await getByKey<SakeRecord>(stores[SAKE_RECORDS_STORE], id);
        if (!record || record.owner_id !== ownerId || record.drink_type !== "sake") {
          resolve(undefined);
          return;
        }

        const [images, recordTags, tags] = await Promise.all([
          getAllByIndex<SakeImage>(stores[SAKE_IMAGES_STORE], "record_id", id),
          getAllByIndex<SakeRecordTag>(stores[SAKE_RECORD_TAGS_STORE], "record_id", id),
          getAllFromStore<SakeTag>(stores[SAKE_TAGS_STORE]),
        ]);

        resolve(buildSakeRecordEntry(record, images, recordTags, tags));
      } catch (error) {
        reject(error);
      }
    },
  );
}

export async function saveSakeRecord(
  draft: SakeDraft,
  ownerId = LOCAL_OWNER_ID,
): Promise<SakeRecordEntry> {
  const now = new Date().toISOString();
  const recordId = crypto.randomUUID();

  if (cloudStorageEnabled) {
    const entry = await cloudRequest<SakeRecordEntry>(CLOUD_SAKE_RECORDS_PATH, {
      method: "POST",
      body: JSON.stringify(buildCloudSakePayload(draft, recordId, now, now)),
    });
    return normalizeCloudSakeEntry(entry);
  }

  const { record, images, recordTags } = buildSakeEntryFromDraft(
    draft,
    recordId,
    ownerId,
    now,
    now,
  );

  return withStores<SakeRecordEntry>(
    "readwrite",
    [SAKE_RECORDS_STORE, SAKE_IMAGES_STORE, SAKE_RECORD_TAGS_STORE, SAKE_TAGS_STORE],
    async (stores, resolve, reject) => {
      try {
        await requestToPromise(stores[SAKE_RECORDS_STORE].put(record));

        await Promise.all(
          images.map((image) => requestToPromise(stores[SAKE_IMAGES_STORE].put(image))),
        );
        await Promise.all(
          recordTags.map((recordTag) =>
            requestToPromise(stores[SAKE_RECORD_TAGS_STORE].put(recordTag)),
          ),
        );

        const tags = await getAllFromStore<SakeTag>(stores[SAKE_TAGS_STORE]);
        resolve(buildSakeRecordEntry(record, images, recordTags, tags));
      } catch (error) {
        reject(error);
      }
    },
  );
}

export async function updateSakeRecord(
  id: string,
  draft: SakeDraft,
  ownerId = LOCAL_OWNER_ID,
): Promise<SakeRecordEntry> {
  if (cloudStorageEnabled) {
    const now = new Date().toISOString();
    const entry = await cloudRequest<SakeRecordEntry>(
      `${CLOUD_SAKE_RECORDS_PATH}/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(buildCloudSakePayload(draft, id, now, now)),
      },
    );
    return normalizeCloudSakeEntry(entry);
  }

  return withStores<SakeRecordEntry>(
    "readwrite",
    [SAKE_RECORDS_STORE, SAKE_IMAGES_STORE, SAKE_RECORD_TAGS_STORE, SAKE_TAGS_STORE],
    async (stores, resolve, reject) => {
      try {
        const existingRecord = await getByKey<SakeRecord>(stores[SAKE_RECORDS_STORE], id);
        if (!existingRecord || existingRecord.owner_id !== ownerId) {
          reject(new Error("Sake record not found."));
          return;
        }

        const [existingImages, existingRecordTags] = await Promise.all([
          getAllByIndex<SakeImage>(stores[SAKE_IMAGES_STORE], "record_id", id),
          getAllByIndex<SakeRecordTag>(stores[SAKE_RECORD_TAGS_STORE], "record_id", id),
        ]);
        const existingImagesById = new Map(
          existingImages.map((image) => [image.id, image]),
        );
        const now = new Date().toISOString();
        const { record, images, recordTags } = buildSakeEntryFromDraft(
          draft,
          id,
          ownerId,
          existingRecord.created_at,
          now,
          existingImagesById,
        );
        const nextImageIds = new Set(images.map((image) => image.id));
        const nextTagIds = new Set(recordTags.map((recordTag) => recordTag.tag_id));

        await Promise.all([
          requestToPromise(stores[SAKE_RECORDS_STORE].put(record)),
          ...existingImages
            .filter((image) => !nextImageIds.has(image.id))
            .map((image) => requestToPromise(stores[SAKE_IMAGES_STORE].delete(image.id))),
          ...images.map((image) => requestToPromise(stores[SAKE_IMAGES_STORE].put(image))),
          ...existingRecordTags
            .filter((recordTag) => !nextTagIds.has(recordTag.tag_id))
            .map((recordTag) =>
              requestToPromise(
                stores[SAKE_RECORD_TAGS_STORE].delete([recordTag.record_id, recordTag.tag_id]),
              ),
            ),
          ...recordTags.map((recordTag) =>
            requestToPromise(stores[SAKE_RECORD_TAGS_STORE].put(recordTag)),
          ),
        ]);

        const tags = await getAllFromStore<SakeTag>(stores[SAKE_TAGS_STORE]);
        resolve(buildSakeRecordEntry(record, images, recordTags, tags));
      } catch (error) {
        reject(error);
      }
    },
  );
}

export async function deleteSakeRecord(id: string, ownerId = LOCAL_OWNER_ID): Promise<void> {
  if (cloudStorageEnabled) {
    await cloudRequest<void>(`${CLOUD_SAKE_RECORDS_PATH}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }

  return withStores<void>(
    "readwrite",
    [SAKE_RECORDS_STORE, SAKE_IMAGES_STORE, SAKE_RECORD_TAGS_STORE],
    async (stores, resolve, reject) => {
      try {
        const record = await getByKey<SakeRecord>(stores[SAKE_RECORDS_STORE], id);
        if (!record || record.owner_id !== ownerId) {
          resolve();
          return;
        }

        const [images, recordTags] = await Promise.all([
          getAllByIndex<SakeImage>(stores[SAKE_IMAGES_STORE], "record_id", id),
          getAllByIndex<SakeRecordTag>(stores[SAKE_RECORD_TAGS_STORE], "record_id", id),
        ]);

        await Promise.all([
          requestToPromise(stores[SAKE_RECORDS_STORE].delete(id)),
          ...images.map((image) => requestToPromise(stores[SAKE_IMAGES_STORE].delete(image.id))),
          ...recordTags.map((recordTag) =>
            requestToPromise(
              stores[SAKE_RECORD_TAGS_STORE].delete([recordTag.record_id, recordTag.tag_id]),
            ),
          ),
        ]);

        resolve();
      } catch (error) {
        reject(error);
      }
    },
  );
}

export function createEmptySectionSelections(profile: DrinkProfile) {
  return PROFILE_SECTIONS[profile].reduce<Record<string, FlavorEntry[]>>(
    (acc, section) => {
      acc[section.id] = [];
      return acc;
    },
    {},
  );
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export async function fileToThumbnailDataUrl(
  file: File,
  maxSize = 160,
  quality = 0.76,
): Promise<string> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
      img.src = imageUrl;
    });

    const ratio = Math.min(maxSize / image.naturalWidth, maxSize / image.naturalHeight, 1);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("썸네일을 만들 수 없습니다.");
    }

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/webp", quality);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
