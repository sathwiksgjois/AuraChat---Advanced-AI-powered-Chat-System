from django.urls import path
from .views import AddContactView, ListContactsView

urlpatterns = [
    path("add/", AddContactView.as_view()),
    path("", ListContactsView.as_view()),
]
