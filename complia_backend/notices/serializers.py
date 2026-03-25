from rest_framework import serializers
from .models import NoticeType, NoticeFeedback, TriggerKeyword

class TriggerKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = TriggerKeyword
        fields = ['keyword']

class NoticeTypeSerializer(serializers.ModelSerializer):
    triggers = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = NoticeType
        fields = [
            'id', 'code', 'title', 'summary', 'detailed_explanation',
            'why_received', 'common_mistakes', 'source_section',
            'consequences_of_ignoring', 'next_steps', 'severity',
            'triggers', 'verified_by', 'verified_at', 'updated_at'
        ]

class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoticeFeedback
        fields = ['notice', 'is_helpful', 'comments', 'created_at']
<<<<<<< Updated upstream

=======
    def validate(self, data):
        if data.get('is_helpful') == False and not data.get('comments', '').strip():
            raise serializers.ValidationError({
                'comments': 'Comments are required when feedback is not helpful.'
            })
        return data    
>>>>>>> Stashed changes
