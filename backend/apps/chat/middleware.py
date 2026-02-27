import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def get_user(user_id):
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None


class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope["query_string"].decode()
        query_params = parse_qs(query_string)
        print("JWT MIDDLEWARE RUNNING")
        print("Query:", scope["query_string"])
        token = query_params.get("token")

        if token:
            try:
                # decoded = jwt.decode(
                #     token[0],
                #     settings.SECRET_KEY,
                #     algorithms=["HS256"],
                # )
                # user = await get_user(decoded["user_id"])
                token_obj = AccessToken(token[0])
                user = await get_user(token_obj["user_id"])
                scope["user"] = user
            except Exception as e:
                print("JWT ERROR:", e)
                scope["user"] = None

        else:
            scope["user"] = None

        return await self.inner(scope, receive, send)
