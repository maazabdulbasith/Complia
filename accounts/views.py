from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from dj_rest_auth.registration.views import SocialLoginView

class GoogleLogin(SocialLoginView):
    """
    Accepts an access_token from Google (implicit flow) and returns a JWT.
    Used by the React frontend's useGoogleLogin hook.
    """
    adapter_class = GoogleOAuth2Adapter
