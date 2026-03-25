from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

class UserManager(BaseUserManager):
    """
    Custom manager for the User model where email is the unique identifier.
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('user_type', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    """
    Enhanced User model for the Complia ecosystem.
    """
    USER_TYPE_CHOICES = (
        ('taxpayer', 'Individual Taxpayer'),
        ('ca', 'Chartered Accountant'),
        ('admin', 'Complia Admin'),
    )

    username = None # Remove username field
    email = models.EmailField('Email Address', unique=True)
    
    user_type = models.CharField(
        max_length=20, 
        choices=USER_TYPE_CHOICES, 
        default='taxpayer'
    )
    
    phone_number = models.CharField(
        max_length=15, 
        blank=True, 
        null=True,
        help_text="Optional: For WhatsApp notifications/login"
    )
    
    is_verified_ca = models.BooleanField(
        default=False,
        help_text="Only applicable for CA user types"
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = [] # Email & Password are required by default

    objects = UserManager()

    def __str__(self):
        return f"{self.email} ({self.get_user_type_display()})"
