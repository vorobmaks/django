from pathlib import Path
import pandas as pd
from catboost import CatBoostClassifier

CONTEXTS = ["workout", "party", "focus", "sleep_relax", "art"]

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "spotify_prepared.csv"
MODEL_PATH = BASE_DIR / "model" / "catboost_tuned.cbm"


class ContextPopularityService:
    def __init__(self, data_path=DATA_PATH, model_path=MODEL_PATH):
        self.df = pd.read_csv(data_path)

        self.df = self.df.reset_index(drop=True)

        self.model = CatBoostClassifier()
        self.model.load_model(str(model_path))

        self.numeric_features = [
            "acousticness", "danceability", "duration_ms", "energy",
            "instrumentalness", "liveness", "loudness",
            "speechiness", "tempo", "valence",
        ]
        self.categorical_features = [
            "genre", "base_ctx", "context_class",
            "key", "mode", "time_signature",
        ]
        self.feature_cols = self.numeric_features + self.categorical_features

        self._precompute_probs()

    def _precompute_probs(self):
        """
        Рахує ймовірності для всіх треків по кожному контексту (batch),
        зберігає в df колонки prob_<ctx>, best_context, best_probability,
        а також top_score_weighted (зважений глобальний скор).
        """
        for col in self.numeric_features:
            if col in self.df.columns:
                self.df[col] = pd.to_numeric(self.df[col], errors="coerce").fillna(0)
            else:
                self.df[col] = 0

        for col in self.categorical_features:
            if col in self.df.columns:
                self.df[col] = self.df[col].astype(str).fillna("")
            else:
                self.df[col] = ""

        for ctx in CONTEXTS:
            tmp = self.df.copy()
            tmp["context_class"] = ctx
            X = tmp[self.feature_cols]
            proba = self.model.predict_proba(X)[:, 1]
            self.df[f"prob_{ctx}"] = proba

        prob_cols = [f"prob_{c}" for c in CONTEXTS]
        self.df["best_context"] = (
            self.df[prob_cols].idxmax(axis=1).str.replace("prob_", "", regex=False)
        )
        self.df["best_probability"] = self.df[prob_cols].max(axis=1)

        # ЗВАЖЕНИЙ скор (можеш змінити ваги)
        weights = {
            "workout": 0.25,
            "party": 0.20,
            "focus": 0.25,
            "sleep_relax": 0.20,
            "art": 0.10,
        }
        self.df["top_score_weighted"] = 0.0
        for ctx, w in weights.items():
            self.df["top_score_weighted"] += self.df[f"prob_{ctx}"] * float(w)

    def search_tracks_text(self, query: str):
        q = (query or "").lower().strip()
        if not q:
            return self.df.iloc[0:0]

        mask = (
            self.df["track_name"].astype(str).str.lower().str.contains(q, na=False)
            | self.df["artist_name"].astype(str).str.lower().str.contains(q, na=False)
            | self.df["genre"].astype(str).str.lower().str.contains(q, na=False)
        )
        return self.df[mask]
