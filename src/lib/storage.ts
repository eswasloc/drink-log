import type {
  Bottle,
  BottleImage,
  DrinkProfile,
  FlavorEntry,
  SensoryNote,
  TastingLog,
} from "../types/models";
import { sortNegativeLast } from "../data/flavors";
import { PROFILE_SECTIONS } from "../data/profiles";

const DB_NAME = "alcohol-log-db";
const DB_VERSION = 2;
const BOTTLES_STORE = "bottles";
const IMAGES_STORE = "images";
const SENSORY_NOTES_STORE = "sensory_notes";
const LEGACY_LOGS_STORE = "logs";

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

export async function saveLog(draft: DraftEntry): Promise<TastingLog> {
  const now = new Date().toISOString();
  const bottleId = crypto.randomUUID();

  const bottle: Bottle = {
    id: bottleId,
    name: draft.bottleName.trim(),
    type: draft.profile,
    brand: draft.brand.trim(),
    abv: draft.abv ? Number(draft.abv) : null,
    created_at: now,
  };

  const sensory: SensoryNote = {
    bottle_id: bottle.id,
    profile: draft.profile,
    sections: sortSectionSelections(draft.sectionSelections),
    note: draft.note.trim(),
  };

  const imagePathPrefix = `images/${bottle.id}`;
  const images = draft.images.map((image) => ({
    ...image,
    bottle_id: bottle.id,
    image_key: `${imagePathPrefix}/${image.id}.${image.file_name.split(".").pop() || "jpg"}`,
  }));

  const entry: TastingLog = {
    id: bottle.id,
    bottle,
    images,
    sensory,
    created_at: now,
  };

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

        const imagePathPrefix = `images/${id}`;
        const images = draft.images.map((image) => ({
          ...image,
          bottle_id: id,
          image_key:
            image.image_key.startsWith(imagePathPrefix)
              ? image.image_key
              : `${imagePathPrefix}/${image.id}.${image.file_name.split(".").pop() || "jpg"}`,
        }));

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
