from django.urls import path
from . import views

urlpatterns = [
    path("genres/", views.list_genres),
    path("top/", views.top_tracks),
    path("search_ranked/", views.search_ranked),
    path("predict/", views.predict_track_contexts),
]
