from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

class Status(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='statuses')
    content = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to='status_files/', null=True, blank=True)
    thumbnail = models.ImageField(upload_to='status_thumbnails/', null=True, blank=True)  # optional
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    viewers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='viewed_statuses', blank=True)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    class Meta:
        ordering = ['-created_at']