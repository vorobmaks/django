import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE = "http://localhost:8000/api";

const isNum = (v) => typeof v === "number" && !Number.isNaN(v);

const CONTEXT_COLORS = {
  workout: "#22c55e",
  party: "#ec4899",
  focus: "#3b82f6",
  sleep_relax: "#8b5cf6",
  art: "#f59e0b",
};

const TOP_DEFAULT = 100;
const SEARCH_FETCH_TOPN = 5000;

export default function App() {
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedContext, setSelectedContext] = useState("");

  const [genres, setGenres] = useState([]);
  const [contexts, setContexts] = useState([]);

  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");

  const [visibleCount, setVisibleCount] = useState(TOP_DEFAULT);

  const [predictLoading, setPredictLoading] = useState(false);
  const [predictError, setPredictError] = useState("");
  const [predictData, setPredictData] = useState(null);
  const [predictCache, setPredictCache] = useState({});

  useEffect(() => {
    const loadMeta = async () => {
      setLoadingMeta(true);
      setError("");

      try {
        const [g, c] = await Promise.all([
          axios.get(`${API_BASE}/genres/`),
          axios.get(`${API_BASE}/contexts/`)
        ]);
        setGenres(g.data.genres || []);
        setContexts(c.data.contexts || []);
      } catch (e) {
        console.error(e);
        setError("Не вдалося завантажити жанри або контексти. Перевір бекенд.");
      } finally {
        setLoadingMeta(false);
      }
    };

    loadMeta();
  }, []);

  useEffect(() => {
    const loadTracks = async () => {
      setLoadingList(true);
      setError("");
      setPredictError("");

      try {
        const paramsBase = {
          ...(selectedGenre ? { genre: selectedGenre } : {}),
          ...(selectedContext ? { context: selectedContext } : {}),
        };

        let fetchedTracks = [];

        if (!activeQuery.trim()) {
          const res = await axios.get(`${API_BASE}/top/`, {
            params: { top_n: 3000, ...paramsBase },
          });
          fetchedTracks = res.data.tracks || [];
          const filtered = fetchedTracks.filter((t) => t.probability <= 0.98);
          setTracks(filtered.slice(0, TOP_DEFAULT));
        } else {
          const res = await axios.get(`${API_BASE}/search_ranked/`, {
            params: { q: activeQuery.trim(), top_n: SEARCH_FETCH_TOPN, ...paramsBase },
          });
          fetchedTracks = res.data.tracks || [];
          const filtered = fetchedTracks.filter((t) => t.probability <= 0.98);
          setTracks(filtered);
        }
      } catch (e) {
        console.error(e);
        setError("Помилка при завантаженні треків");
        setTracks([]);
      } finally {
        setLoadingList(false);
      }
    };

    loadTracks();
  }, [activeQuery, selectedGenre, selectedContext]);

  useEffect(() => {
    setVisibleCount(tracks.length ? Math.min(TOP_DEFAULT, tracks.length) : 0);
  }, [tracks]);

  const handleSearch = () => setActiveQuery(queryInput.trim());

  const clearAll = () => {
    setQueryInput("");
    setActiveQuery("");
    setSelectedGenre("");
    setSelectedContext("");
    setSelectedTrack(null);
    setPredictData(null);
    setPredictError("");
  };

  const clearFilters = () => {
    setSelectedGenre("");
    setSelectedContext("");
  };

  const fetchPredictForTrack = async (track) => {
    if (!track) return;
    const id = track.id;

    if (predictCache[id]) {
      setPredictData(predictCache[id]);
      setPredictError("");
      return;
    }

    setPredictLoading(true);
    setPredictError("");

    try {
      const res = await axios.post(`${API_BASE}/predict/`, { id });
      const data = res.data || null;
      setPredictData(data);
      setPredictCache((prev) => ({ ...prev, [id]: data }));
    } catch (e) {
      console.error(e);
      setPredictError("Не вдалося отримати ймовірності.");
    } finally {
      setPredictLoading(false);
    }
  };

  const onSelectTrack = (t) => {
    setSelectedTrack(t);
    fetchPredictForTrack(t);
  };

  const fmtProb = (v) => (isNum(v) ? v.toFixed(3) : "—");

  const title = useMemo(
    () =>
      activeQuery.trim()
        ? "Результати пошуку (відсортовано за популярністю)"
        : `Топ-${TOP_DEFAULT} найпопулярніших треків`,
    [activeQuery]
  );

  const chartData = useMemo(() => {
    const scores = predictData?.scores || [];
    const bestCtx = predictData?.best?.context;

    return {
      labels: scores.map((s) => s.context),
      datasets: [
        {
          label: "Ймовірність",
          data: scores.map((s) => Number(s.probability) || 0),
          backgroundColor: scores.map((s) =>
            s.context === bestCtx
              ? CONTEXT_COLORS[s.context] || "#0ea5e9"
              : (CONTEXT_COLORS[s.context] || "#94a3b8") + "99"
          ),
          borderColor: scores.map((s) =>
            s.context === bestCtx
              ? CONTEXT_COLORS[s.context] || "#0ea5e9"
              : "#64748b"
          ),
          borderWidth: scores.map((s) => (s.context === bestCtx ? 2 : 1)),
          borderRadius: 10,
          maxBarThickness: 60,
        },
      ],
    };
  }, [predictData]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Ймовірність популярності по контекстах",
          font: { size: 14, weight: "600" },
          padding: { bottom: 10 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${(ctx.raw * 100).toFixed(1)}%`,
          },
        },
      },
      scales: {
        y: { beginAtZero: true, max: 1, ticks: { callback: (v) => `${Math.round(v * 100)}%` }, grid: { color: "#e5e7eb" } },
        x: { grid: { display: false } },
      },
    }),
    []
  );

  return (
    <div className="page">
      <div className="main-card">
        <h1 className="title">Контекстна популярність треків Spotify</h1>
        <p className="subtitle">Пошук і аналіз треків + фільтри жанру та контексту.</p>

        <div className="search-block">
          <label className="field-label">Пошук треку</label>
          <div className="search-row">
            <input
              type="text"
              placeholder="Назва треку, виконавець або жанр..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button onClick={handleSearch} disabled={loadingList}>
              {loadingList ? "Оновлення..." : "Пошук"}
            </button>
            <button className="chip" onClick={clearAll} disabled={loadingList}>
              Скинути все
            </button>
          </div>

          {(selectedGenre || selectedContext) && (
            <div className="chips-row" style={{ marginTop: 10 }}>
              {selectedGenre && (
                <span className="chip chip--active" onClick={() => setSelectedGenre("")}>
                  Жанр: {selectedGenre} ✕
                </span>
              )}
              {selectedContext && (
                <span className="chip chip--active" onClick={() => setSelectedContext("")}>
                  Контекст: {selectedContext} ✕
                </span>
              )}
              <button className="chip" onClick={clearFilters}>
                Очистити фільтри
              </button>
            </div>
          )}

          {error && <div className="error-text">{error}</div>}
          {loadingMeta && <div className="muted-small">Завантаження жанрів і контекстів…</div>}
        </div>

        <div className="columns">
          <div className="col">
            <h2 className="section-title">Жанри</h2>
            <div className="chips-row" style={{ maxHeight: 260, overflow: "auto" }}>
              {genres.length === 0 && !loadingMeta && <span className="muted-small">Жанри не завантажились.</span>}
              {genres.map((g) => (
                <button key={g} className={"chip" + (selectedGenre === g ? " chip--active" : "")} onClick={() => setSelectedGenre(g)}>
                  {g}
                </button>
              ))}
            </div>

            <h2 className="section-title" style={{ marginTop: 12 }}>Контексти</h2>
            <div className="chips-row" style={{ maxHeight: 260, overflow: "auto" }}>
              {contexts.length === 0 && !loadingMeta && <span className="muted-small">Контексти не завантажились.</span>}
              {contexts.map((c) => (
                <button key={c} className={"chip" + (selectedContext === c ? " chip--active" : "")} onClick={() => setSelectedContext(c)}>
                  {c}
                </button>
              ))}
            </div>

            <div style={{ height: 18 }} />

            {selectedTrack ? (
              <div className="block-card">
                <h3 className="track-title">{selectedTrack.track_name}</h3>
                <p><b>Виконавець:</b> {selectedTrack.artist_name}</p>
                <p><b>Жанр:</b> {selectedTrack.genre || "—"}</p>
                <p><b>Найкращий контекст:</b> <span className="badge">{selectedTrack.best_context || "—"}</span></p>
                <p><b>Популярність:</b> {fmtProb(selectedTrack.probability)}</p>

                <div style={{ height: 10 }} />
                <h4 style={{ margin: "8px 0" }}>Ймовірність популярності по контекстах</h4>

                <div style={{ minHeight: "20px" }}>
                  {predictLoading && <div className="muted-small">Оновлення…</div>}
                  {predictError && <div className="error-text">{predictError}</div>}
                </div>

                {predictData?.scores?.length > 0 && (
                  <div style={{ opacity: predictLoading ? 0.6 : 1, transition: "opacity 0.2s ease-in-out" }}>
                    <div className="table-scroll" style={{ maxHeight: 240 }}>
                      <table className="score-table">
                        <thead>
                          <tr><th>Контекст</th><th>Ймовірність</th></tr>
                        </thead>
                        <tbody>
                          {predictData.scores.map((s) => (
                            <tr key={s.context}><td>{s.context}</td><td>{fmtProb(s.probability)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: 14, height: 280 }}>
                      <Bar data={chartData} options={chartOptions} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="muted">Клікніть по треку справа, щоб побачити деталі.</div>
            )}
          </div>

          <div className="col">
            <h2 className="section-title">{title}</h2>

            {loadingList && <p className="muted">Завантаження…</p>}
            {!loadingList && tracks.length === 0 && <p className="muted">Нічого не знайдено.</p>}

            {!loadingList && tracks.length > 0 && (
              <div className="block-card">
                <div style={{ marginBottom: 12 }}>
                  <label className="field-label" style={{ display: "block" }}>
                    Показати пісень у списку: <b>{visibleCount}</b>
                    {activeQuery && <span className="muted-small"> (усього {tracks.length})</span>}
                  </label>

                  {(() => {
                    const sliderMax = Math.max(10, Math.ceil(tracks.length / 10) * 10);
                    return (
                      <input
                        type="range"
                        min={10}
                        max={sliderMax}
                        step={10}
                        value={visibleCount === tracks.length ? sliderMax : visibleCount}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setVisibleCount(v === sliderMax ? tracks.length : v);
                        }}
                        style={{ width: "100%" }}
                      />
                    );
                  })()}
                </div>

                <div className="table-scroll">
                  <table className="score-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Трек</th>
                        <th>Виконавець</th>
                        <th>Жанр</th>
                        <th>Контекст</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tracks.slice(0, visibleCount).map((t, i) => (
                        <tr
                          key={t.id}
                          className={selectedTrack?.id === t.id ? "track-item--active" : ""}
                          onClick={() => onSelectTrack(t)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{i + 1}</td>
                          <td>{t.track_name}</td>
                          <td>{t.artist_name}</td>
                          <td>{t.genre || "—"}</td>
                          <td>{t.best_context || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
