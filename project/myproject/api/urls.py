from django.urls import path
from . import views

urlpatterns = [
    path("genres/", views.list_genres),
    path("contexts/", views.list_contexts),
    path("top/", views.top_tracks),
    path("search_ranked/", views.search_ranked),
    path("predict/", views.predict_track_contexts),
    path("top_by_genre/", views.top_tracks_by_genre),
    path("top_by_context/", views.top_tracks_by_context),
]
