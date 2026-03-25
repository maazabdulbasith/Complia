from rest_framework import serializers
from .models import User

class UserDetailSerializer(serializers.ModelSerializer):
    """
    Serializes the Custom User model for standard API responses.
    Included in dj-rest-auth calls for profile/login.
    """
    class Meta:
        model = User
        fields = (
            'id', 
            'email', 
            'first_name', 
            'last_name', 
            'user_type', 
            'phone_number', 
            'is_verified_ca'
        )
        read_only_fields = ('email', 'is_verified_ca')
