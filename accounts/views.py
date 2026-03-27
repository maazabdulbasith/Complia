from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from dj_rest_auth.registration.views import SocialLoginView
from rest_framework import generics, permissions
from rest_framework.throttling import ScopedRateThrottle

from .serializers import CAHelpRequestSerializer

class GoogleLogin(SocialLoginView):
    """
    Accepts an access_token from Google (implicit flow) and returns a JWT.
    Used by the React frontend's useGoogleLogin hook.
    """
    adapter_class = GoogleOAuth2Adapter


class CAHelpRequestCreateView(generics.CreateAPIView):
    serializer_class = CAHelpRequestSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ca_help"

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)
