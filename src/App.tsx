import { useEffect, useMemo, useState } from "react";
import { CategoryGrid } from "./components/CategoryGrid";
import { FlavorPicker } from "./components/FlavorPicker";
import { CATEGORY_ORDER, FLAVOR_DEFINITIONS } from "./data/flavors";
import { PROFILE_LABELS, PROFILE_SECTIONS } from "./data/profiles";
import {
  createEmptySectionSelections,
  createDraftFromLog,
  createInitialDraft,
  deleteLog,
  fileToDataUrl,
  fileToThumbnailDataUrl,
  getLogById,
  loadLogs,
  saveLog,
  updateLog,
  type DraftEntry,
} from "./lib/storage";
import type {
  BottleImage,
  FlavorCategory,
  FlavorDefinition,
  FlavorEntry,
  TastingLog,
} from "./types/models";

type Route =
  | { page: "compose" }
  | { page: "logs" }
  | { page: "detail"; id: string }
  | { page: "edit"; id: string };

function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);

  if (parts[0] === "logs" && parts[1] && parts[2] === "edit") {
    return { page: "edit", id: parts[1] };
  }

  if (parts[0] === "logs" && parts[1]) {
    return { page: "detail", id: parts[1] };
  }

  if (parts[0] === "logs") {
    return { page: "logs" };
  }

  return { page: "compose" };
}

function navigateTo(route: Route) {
  if (route.page === "compose") {
    window.location.hash = "/";
    return;
  }

  if (route.page === "logs") {
    window.location.hash = "/logs";
    return;
  }

  if (route.page === "edit") {
    window.location.hash = `/logs/${route.id}/edit`;
    return;
  }

  window.location.hash = `/logs/${route.id}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getSelectedForSection(draft: DraftEntry) {
  return draft.sectionSelections[draft.sectionId] ?? [];
}

function serializeDraft(draft: DraftEntry) {
  return JSON.stringify({
    bottleName: draft.bottleName,
    brand: draft.brand,
    abv: draft.abv,
    profile: draft.profile,
    sectionId: draft.sectionId,
    sectionSelections: draft.sectionSelections,
    note: draft.note,
    images: draft.images.map((image) => image.id),
  });
}

function getTotalFlavors(log: TastingLog) {
  return Object.values(log.sensory.sections).flat().length;
}

function getProfileInitial(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

const FLAVOR_LABELS = new Map(
  FLAVOR_DEFINITIONS.map((flavor) => [flavor.key, flavor.label]),
);

function getFlavorLabel(flavorKey: string) {
  return FLAVOR_LABELS.get(flavorKey) ?? flavorKey;
}

function getFeaturedFlavors(log: TastingLog) {
  return PROFILE_SECTIONS[log.sensory.profile]
    .flatMap((section) =>
      (log.sensory.sections[section.id] ?? []).map((entry) => ({
        ...entry,
        sectionLabel: section.label,
      })),
    )
    .sort((left, right) => right.intensity - left.intensity)
    .slice(0, 3);
}

function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [draft, setDraft] = useState<DraftEntry>(() => createInitialDraft());
  const [activeCategory, setActiveCategory] = useState<FlavorCategory>("sweet");
  const [logs, setLogs] = useState<TastingLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<TastingLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editBaseline, setEditBaseline] = useState<string | null>(null);

  const sections = PROFILE_SECTIONS[draft.profile];
  const selectedForSection = getSelectedForSection(draft);

  const totalSelected = useMemo(
    () =>
      Object.values(draft.sectionSelections).reduce(
        (count, entries) => count + entries.length,
        0,
      ),
    [draft.sectionSelections],
  );
  const canSave = draft.bottleName.trim().length > 0 && totalSelected > 0;
  const hasUnsavedEdit =
    route.page === "edit" && editBaseline !== null && serializeDraft(draft) !== editBaseline;

  useEffect(() => {
    const onHashChange = () => {
      const nextRoute = parseRoute();
      if (hasUnsavedEdit && nextRoute.page !== "edit") {
        const confirmed = window.confirm("수정 중인 내용이 저장되지 않았습니다. 나갈까요?");
        if (!confirmed) {
          navigateTo(route);
          return;
        }
      }

      setRoute(nextRoute);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [hasUnsavedEdit, route]);

  useEffect(() => {
    if (route.page === "compose") {
      setDraft(createInitialDraft());
      setActiveCategory(CATEGORY_ORDER[0]);
      setEditBaseline(null);
    }
  }, [route]);

  useEffect(() => {
    let cancelled = false;

    async function syncLogs() {
      setIsLoading(true);
      const nextLogs = await loadLogs();
      if (!cancelled) {
        setLogs(nextLogs);
        setIsLoading(false);
      }
    }

    void syncLogs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncSelectedLog() {
      if (route.page !== "detail" && route.page !== "edit") {
        setSelectedLog(null);
        return;
      }

      setIsLoading(true);
      const nextLog = await getLogById(route.id);
      if (!cancelled) {
        setSelectedLog(nextLog ?? null);
        if (route.page === "edit" && nextLog) {
          const nextDraft = createDraftFromLog(nextLog);
          setDraft(nextDraft);
          setEditBaseline(serializeDraft(nextDraft));
          setActiveCategory(CATEGORY_ORDER[0]);
        }
        setIsLoading(false);
      }
    }

    void syncSelectedLog();
    return () => {
      cancelled = true;
    };
  }, [route]);

  function updateDraft<K extends keyof DraftEntry>(key: K, value: DraftEntry[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleProfileChange(nextProfile: DraftEntry["profile"]) {
    setDraft((current) => ({
      ...current,
      profile: nextProfile,
      sectionId: PROFILE_SECTIONS[nextProfile][0].id,
      sectionSelections: createEmptySectionSelections(nextProfile),
    }));
    setActiveCategory(CATEGORY_ORDER[0]);
  }

  function handleToggleFlavor(flavor: FlavorDefinition) {
    setDraft((current) => {
      const currentEntries = current.sectionSelections[current.sectionId] ?? [];
      const exists = currentEntries.find((entry) => entry.flavor === flavor.key);

      const nextEntries = exists
        ? currentEntries.filter((entry) => entry.flavor !== flavor.key)
        : [
            ...currentEntries,
            {
              flavor: flavor.key,
              intensity: 2,
              valence: flavor.valence,
              category: flavor.category,
            } satisfies FlavorEntry,
          ];

      return {
        ...current,
        sectionSelections: {
          ...current.sectionSelections,
          [current.sectionId]: nextEntries,
        },
      };
    });
  }

  function handleIntensityChange(flavorKey: string, intensity: number) {
    setDraft((current) => ({
      ...current,
      sectionSelections: {
        ...current.sectionSelections,
        [current.sectionId]: (current.sectionSelections[current.sectionId] ?? []).map(
          (entry) => (entry.flavor === flavorKey ? { ...entry, intensity } : entry),
        ),
      },
    }));
  }

  async function handleImageChange(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const nextImages: BottleImage[] = await Promise.all(
      Array.from(files)
        .slice(0, Math.max(0, 4 - draft.images.length))
        .map(async (file) => {
          const [dataUrl, thumbnailDataUrl] = await Promise.all([
            fileToDataUrl(file),
            fileToThumbnailDataUrl(file),
          ]);

          return {
            id: crypto.randomUUID(),
            bottle_id: "",
            image_key: `indexeddb/${file.name}`,
            data_url: dataUrl,
            thumbnail_data_url: thumbnailDataUrl,
            mime_type: file.type || "image/jpeg",
            file_name: file.name,
            created_at: new Date().toISOString(),
          };
        }),
    );

    setDraft((current) => ({
      ...current,
      images: [...current.images, ...nextImages].slice(0, 4),
    }));
  }

  function handleRemoveImage(imageId: string) {
    setDraft((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== imageId),
    }));
  }

  function confirmDiscardEdit() {
    if (!hasUnsavedEdit) {
      return true;
    }

    return window.confirm("수정 중인 내용이 저장되지 않았습니다. 나갈까요?");
  }

  function handleNavigate(routeToNavigate: Route) {
    if (!confirmDiscardEdit()) {
      return;
    }

    if (routeToNavigate.page === "compose") {
      setDraft(createInitialDraft());
      setActiveCategory(CATEGORY_ORDER[0]);
      setEditBaseline(null);
    }

    navigateTo(routeToNavigate);
  }

  async function handleSave() {
    if (!draft.bottleName.trim() || totalSelected === 0) {
      return;
    }

    setIsSaving(true);
    try {
      const entry =
        route.page === "edit" ? await updateLog(route.id, draft) : await saveLog(draft);
      const nextLogs = await loadLogs();
      setLogs(nextLogs);
      setSelectedLog(entry);
      setDraft(createInitialDraft());
      setEditBaseline(null);
      setActiveCategory(CATEGORY_ORDER[0]);
      navigateTo({ page: "detail", id: entry.id });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteLog(logId: string) {
    const confirmed = window.confirm("이 기록을 삭제할까요? 삭제한 기록은 되돌릴 수 없습니다.");
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteLog(logId);
      const nextLogs = await loadLogs();
      setLogs(nextLogs);
      setSelectedLog(null);
      navigateTo({ page: "logs" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Tasting Journal</p>
          <h1>Alcohol Log</h1>
          <p className="hero-copy">
            마신 술의 사진, 향, 맛, 여운을 가볍게 남겨 두는 개인 테이스팅 노트입니다.
          </p>
        </div>
        <nav className="top-nav" aria-label="Primary">
          <button
            type="button"
            className={route.page === "compose" ? "is-active" : ""}
            onClick={() => handleNavigate({ page: "compose" })}
          >
            새 기록
          </button>
          <button
            type="button"
            className={route.page !== "compose" ? "is-active" : ""}
            onClick={() => handleNavigate({ page: "logs" })}
          >
            기록 목록
          </button>
        </nav>
      </header>

      {route.page === "compose" || route.page === "edit" ? (
        <main className="single-column">
          {route.page === "edit" && isLoading ? (
            <section className="panel">
              <p className="empty-copy">불러오는 중...</p>
            </section>
          ) : null}

          {route.page === "edit" && !isLoading && !selectedLog ? (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="kicker">Edit</p>
                  <h2>기록을 찾을 수 없습니다</h2>
                </div>
              </div>
              <button
                type="button"
                className="save-button"
                onClick={() => handleNavigate({ page: "logs" })}
              >
                목록으로 돌아가기
              </button>
            </section>
          ) : null}

          {route.page === "compose" || (route.page === "edit" && selectedLog) ? (
            <section className="panel composer">
            <div className="panel-header">
              <div>
                <p className="kicker">Tasting Note</p>
                <h2>{route.page === "edit" ? "기록 수정" : "오늘의 한 잔 기록"}</h2>
              </div>
              <span className="badge">향미 {totalSelected}개</span>
            </div>

            <div className={`upload-panel ${draft.images.length > 0 ? "has-images" : ""}`}>
              <label className="upload-dropzone">
                <span>사진 추가</span>
                <small>라벨이나 잔 사진을 최대 4장까지 남길 수 있습니다.</small>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => void handleImageChange(event.target.files)}
                />
              </label>
              <div className="image-strip">
                {draft.images.map((image) => (
                  <div key={image.id} className="image-preview">
                    <img src={image.data_url} alt={image.file_name} />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(image.id)}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="input-grid">
              <label>
                술 이름
                <input
                  value={draft.bottleName}
                  onChange={(event) => updateDraft("bottleName", event.target.value)}
                  placeholder="Yamazaki 12"
                />
              </label>
              <label>
                브랜드
                <input
                  value={draft.brand}
                  onChange={(event) => updateDraft("brand", event.target.value)}
                  placeholder="Suntory"
                />
              </label>
              <label>
                도수
                <input
                  value={draft.abv}
                  onChange={(event) => updateDraft("abv", event.target.value)}
                  placeholder="43"
                  inputMode="decimal"
                />
              </label>
              <label>
                종류
                <select
                  value={draft.profile}
                  onChange={(event) =>
                    handleProfileChange(event.target.value as DraftEntry["profile"])
                  }
                >
                  {Object.entries(PROFILE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="section-tabs">
              {sections.map((section) => {
                const count = draft.sectionSelections[section.id]?.length ?? 0;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={draft.sectionId === section.id ? "is-active" : ""}
                    onClick={() => updateDraft("sectionId", section.id)}
                  >
                    <span>{section.label}</span>
                    <small>{section.helper}</small>
                    <em>{count}</em>
                  </button>
                );
              })}
            </div>

            <CategoryGrid
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />

            <FlavorPicker
              category={activeCategory}
              selected={selectedForSection}
              onToggle={handleToggleFlavor}
              onIntensityChange={handleIntensityChange}
            />

            <label className="note-field">
              짧은 메모
              <textarea
                value={draft.note}
                onChange={(event) => updateDraft("note", event.target.value)}
                placeholder="취한 상태에서도 나중에 기억날 한 줄"
                rows={3}
              />
            </label>

            {route.page === "edit" ? (
              <button
                type="button"
                className="ghost-button full-width"
                onClick={() => handleNavigate({ page: "detail", id: route.id })}
              >
                수정 취소
              </button>
            ) : null}

            <button
              type="button"
              className="save-button"
              onClick={() => void handleSave()}
              disabled={isSaving || !canSave}
            >
              {isSaving ? "저장 중..." : route.page === "edit" ? "수정 저장" : "기록 저장"}
            </button>
          </section>
          ) : null}
        </main>
      ) : null}

      {route.page === "logs" ? (
        <main className="single-column">
          <section className="panel list-panel">
            <div className="panel-header">
              <div>
                <p className="kicker">Archive</p>
                <h2>저장된 기록 목록</h2>
              </div>
              <span className="badge">{logs.length}개</span>
            </div>

            {isLoading ? <p className="empty-copy">불러오는 중...</p> : null}
            {!isLoading && logs.length === 0 ? (
              <p className="empty-copy">아직 저장된 기록이 없습니다. 먼저 한 잔을 기록해 보세요.</p>
            ) : null}

            <div className="log-list">
              {logs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  className="log-card log-card-button"
                  onClick={() => handleNavigate({ page: "detail", id: log.id })}
                >
                  <div className="log-thumbnail" aria-hidden="true">
                    {log.images[0]?.thumbnail_data_url ? (
                      <img src={log.images[0].thumbnail_data_url} alt="" />
                    ) : (
                      <span>{getProfileInitial(PROFILE_LABELS[log.bottle.type])}</span>
                    )}
                  </div>
                  <div className="log-card-content">
                    <div className="log-card-main">
                      <div>
                        <strong>{log.bottle.name}</strong>
                        <p>
                          {PROFILE_LABELS[log.bottle.type]} · {log.bottle.brand || "브랜드 미입력"}
                        </p>
                      </div>
                      <span>{formatDate(log.created_at)}</span>
                    </div>
                    <div className="log-card-meta">
                      <span>{log.sensory.note || "메모 없음"}</span>
                    </div>
                    {getFeaturedFlavors(log).length > 0 ? (
                      <div className="log-flavor-chips">
                        {getFeaturedFlavors(log).map((entry) => (
                          <span
                            key={`${log.id}-${entry.flavor}`}
                            className={`is-${entry.category} ${entry.valence === "negative" ? "is-negative" : ""}`}
                          >
                            <small>{entry.sectionLabel}</small>
                            {getFlavorLabel(entry.flavor)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </main>
      ) : null}

      {route.page === "detail" ? (
        <main className="single-column">
          <section className="panel detail-panel">
            {isLoading ? <p className="empty-copy">불러오는 중...</p> : null}
            {!isLoading && !selectedLog ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="kicker">Detail</p>
                    <h2>기록을 찾을 수 없습니다</h2>
                  </div>
                </div>
                <button
                  type="button"
                  className="save-button"
                  onClick={() => handleNavigate({ page: "logs" })}
                >
                  목록으로 돌아가기
                </button>
              </>
            ) : null}

            {!isLoading && selectedLog ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="kicker">Detail</p>
                    <h2>{selectedLog.bottle.name}</h2>
                    <p className="detail-subtitle">
                      {PROFILE_LABELS[selectedLog.bottle.type]} · {selectedLog.bottle.brand || "브랜드 미입력"} · {formatDate(selectedLog.created_at)}
                    </p>
                  </div>
                  <div className="detail-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleNavigate({ page: "logs" })}
                    >
                      목록으로
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleNavigate({ page: "edit", id: selectedLog.id })}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void handleDeleteLog(selectedLog.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                </div>

                <div className="detail-summary">
                  <span>도수 {selectedLog.bottle.abv ?? "-"}%</span>
                  <span>사진 {selectedLog.images.length}장</span>
                  <span>향미 {getTotalFlavors(selectedLog)}개</span>
                </div>

                {selectedLog.images.length > 0 ? (
                  <div className="detail-gallery">
                    {selectedLog.images.map((image) => (
                      <img key={image.id} src={image.data_url} alt={image.file_name} />
                    ))}
                  </div>
                ) : null}

                <div className="detail-grid">
                  {PROFILE_SECTIONS[selectedLog.sensory.profile].map((section) => {
                    const entries = selectedLog.sensory.sections[section.id] ?? [];
                    return (
                      <article key={section.id} className="detail-section">
                        <h3>{section.label}</h3>
                        <p>{section.helper}</p>
                        {entries.length === 0 ? (
                          <span className="empty-copy">기록 없음</span>
                        ) : (
                          <div className="detail-flavors">
                            {entries.map((entry) => (
                              <div
                                key={`${section.id}-${entry.flavor}`}
                                className={`detail-flavor ${entry.valence === "negative" ? "is-negative" : ""}`}
                              >
                                <strong>{getFlavorLabel(entry.flavor)}</strong>
                                <span>{"★".repeat(entry.intensity)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="detail-note">
                  <h3>메모</h3>
                  <p>{selectedLog.sensory.note || "남긴 메모가 없습니다."}</p>
                </div>
              </>
            ) : null}
          </section>
        </main>
      ) : null}
    </div>
  );
}

export default App;
