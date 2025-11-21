"""Autenticación JWT personalizada para el módulo users."""
from rest_framework import authentication, exceptions
from rest_framework_simplejwt.tokens import AccessToken

from users.models import Usuario


class JWTAuthentication(authentication.BaseAuthentication):
    """Autenticación basada en tokens JWT."""

    def authenticate(self, request):
        """
        Autentica una solicitud usando JWT.

        Args:
            request: La solicitud HTTP

        Returns:
            Tupla (usuario, None) si es exitoso, None si no hay token

        Raises:
            AuthenticationFailed: Si el token es inválido
        """
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None

        try:
            prefix, token = auth_header.split(" ")
            if prefix.lower() != "bearer":
                raise exceptions.AuthenticationFailed(
                    "Formato de token inválido"
                )

            access_token = AccessToken(token)
            usuario_id = access_token.get("usuario_id")
            usuario = Usuario.objects.get(id=usuario_id)

        except Exception:
            raise exceptions.AuthenticationFailed(
                "Token no válido o usuario no encontrado"
            )

        return (usuario, None)
