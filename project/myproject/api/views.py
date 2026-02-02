from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from .src.serving import ContextPopularityService, CONTEXTS
import json

service = ContextPopularityService()

@require_GET
def list_genres(request):
    df = service.df
    if "genre" not in df.columns:
        return JsonResponse({"genres": []})

    genres = (
        df["genre"]
        .dropna()
        .astype(str)
        .unique()
        .tolist()
    )
    genres = sorted([g for g in genres if g.strip() != ""])
    return JsonResponse({"genres": genres})

@require_GET
def list_contexts(request):
    return JsonResponse({"contexts": CONTEXTS})

@require_GET
def top_tracks(request):
    try:
        top_n = int(request.GET.get("top_n", 20))
    except ValueError:
        top_n = 20

    genre = request.GET.get("genre")
    ctx = request.GET.get("context")

    df = service.df

    if genre:
        df = df[df["genre"] == genre]

    if ctx:
        if ctx not in CONTEXTS:
            return JsonResponse({"detail": f"context must be one of {CONTEXTS}"}, status=400)
        df = df.sort_values(f"prob_{ctx}", ascending=False)
    else:
        sort_col = "top_score_weighted" if "top_score_weighted" in df.columns else "best_probability"
        df = df.sort_values(sort_col, ascending=False)

    df = df.head(top_n)

    tracks = []
    for idx, row in df.iterrows():
        best_ctx = row.get("best_context", "")
        best_prob = float(row.get("best_probability", 0.0))

        if ctx:
            best_ctx = ctx
            best_prob = float(row.get(f"prob_{ctx}", 0.0))

        tracks.append({
            "id": int(idx),
            "track_name": row.get("track_name", ""),
            "artist_name": row.get("artist_name", ""),
            "genre": row.get("genre", ""),
            "best_context": best_ctx,
            "probability": best_prob,
        })

    return JsonResponse({"tracks": tracks})


@require_GET
def search_ranked(request):
    q = request.GET.get("q", "").strip()
    genre = request.GET.get("genre")
    ctx = request.GET.get("context")

    try:
        top_n = int(request.GET.get("top_n", 50))
    except ValueError:
        top_n = 50

    if not q:
        return JsonResponse({"tracks": []})

    df = service.search_tracks_text(q)

    if genre:
        df = df[df["genre"] == genre]

    if ctx:
        if ctx not in CONTEXTS:
            return JsonResponse({"detail": f"context must be one of {CONTEXTS}"}, status=400)
        df = df.sort_values(f"prob_{ctx}", ascending=False)
    else:
        sort_col = "top_score_weighted" if "top_score_weighted" in df.columns else "best_probability"
        df = df.sort_values(sort_col, ascending=False)

    df = df.head(top_n)

    tracks = []
    for idx, row in df.iterrows():
        best_ctx = row.get("best_context", "")
        best_prob = float(row.get("best_probability", 0.0))

        if ctx:
            best_ctx = ctx
            best_prob = float(row.get(f"prob_{ctx}", 0.0))

        tracks.append({
            "id": int(idx),
            "track_name": row.get("track_name", ""),
            "artist_name": row.get("artist_name", ""),
            "genre": row.get("genre", ""),
            "best_context": best_ctx,
            "probability": best_prob,
        })

    return JsonResponse({"tracks": tracks})

@csrf_exempt
@require_POST
def predict_track_contexts(request):
    try:
        body = json.loads(request.body.decode("utf-8"))
        track_id = int(body.get("id"))
    except Exception:
        return JsonResponse({"detail": "Invalid JSON or id"}, status=400)

    df = service.df
    if track_id < 0 or track_id >= len(df):
        return JsonResponse({"detail": "Track id out of range"}, status=400)

    row = df.iloc[track_id]

    scores = []
    for ctx in CONTEXTS:
        p = float(row.get(f"prob_{ctx}", 0.0))
        scores.append({"context": ctx, "probability": p})

    best_ctx = row.get("best_context", "")
    best_prob = float(row.get("best_probability", 0.0))

    return JsonResponse({
        "id": track_id,
        "scores": scores,
        "best": {"context": best_ctx, "probability": best_prob},
    })

@require_GET
def top_tracks_by_genre(request):
    genre = request.GET.get("genre", "")
    if not genre:
        return JsonResponse({"tracks": []})

    try:
        top_n = int(request.GET.get("top_n", 20))
    except ValueError:
        top_n = 20

    df = service.df
    df = df[df["genre"] == genre]

    sort_col = "top_score_weighted" if "top_score_weighted" in df.columns else "best_probability"
    df = df.sort_values(sort_col, ascending=False).head(top_n)

    tracks = []
    for idx, row in df.iterrows():
        tracks.append({
            "id": int(idx),
            "track_name": row.get("track_name", ""),
            "artist_name": row.get("artist_name", ""),
            "genre": row.get("genre", ""),
            "best_context": row.get("best_context", ""),
            "probability": float(row.get("best_probability", 0.0)),
        })

    return JsonResponse({"tracks": tracks})


@require_GET
def top_tracks_by_context(request):
    ctx = request.GET.get("context", "")
    if not ctx:
        return JsonResponse({"tracks": []})

    if ctx not in CONTEXTS:
        return JsonResponse({"detail": f"context must be one of {CONTEXTS}"}, status=400)

    try:
        top_n = int(request.GET.get("top_n", 20))
    except ValueError:
        top_n = 20

    df = service.df.sort_values(f"prob_{ctx}", ascending=False).head(top_n)

    tracks = []
    for idx, row in df.iterrows():
        tracks.append({
            "id": int(idx),
            "track_name": row.get("track_name", ""),
            "artist_name": row.get("artist_name", ""),
            "genre": row.get("genre", ""),
            "best_context": ctx,
            "probability": float(row.get(f"prob_{ctx}", 0.0)),
        })

    return JsonResponse({"tracks": tracks})