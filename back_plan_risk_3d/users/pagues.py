"""Procesamiento de pagos con Stripe."""
from datetime import date, datetime, timedelta

import stripe
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Usuario


stripe.api_key = (
    "sk_test_51SPXgBHisFNi9cpHBLgCrW8rHFZRokvF7AFGUkecGdlwYMu"
    "crehmGjPf1234LhfK8JNdyaLgUgeIx9HQvMecEl7Y001l5EOsBa"
)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_payment(request):
    """
    Procesar pago y actualizar plan de usuario.

    Args:
        request: Request con plan y monto

    Returns:
        Response con resultado del procesamiento
    """
    try:
        user = request.user
        plan = request.data.get('plan')
        monto = request.data.get('monto')

        valid_plans = ['usuario_normal', 'usuario_premium']
        if plan not in valid_plans:
            return Response(
                {
                    'success': False,
                    'message': 'Plan no válido.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Lógica de actualización de plan
        if plan == 'usuario_premium':
            if not user.fecha_expiracion_plan:
                user.fecha_expiracion_plan = date.today()
            user.fecha_expiracion_plan += timedelta(days=30)
            if user.rol == 'usuario_normal':
                user.rol = 'usuario_premium'
        else:
            user.rol = 'usuario_normal'

        user.save()

        return Response(
            {
                'success': True,
                'message': (
                    f'Pago procesado exitosamente. '
                    f'Rol actualizado a {plan}.'
                ),
                'usuario': {
                    'id': user.id,
                    'nombre': user.nombre,
                    'email': user.email,
                    'rol': user.rol,
                    'fecha_expiracion_plan': user.fecha_expiracion_plan,
                    'fecha_registro': user.fecha_registro,
                    'telefono': user.telefono,
                    'url': user.url
                }
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        return Response(
            {
                'success': False,
                'message': f'Error interno: {str(e)}'
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
