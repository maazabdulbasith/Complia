from django.db import transaction
from django.utils import timezone

from .models import PaymentOrder, UserEntitlement


def is_success_status(value: str) -> bool:
    return (value or "").strip().upper() in {"SUCCESS", "PAID", "COMPLETED", "CAPTURED"}


def is_failure_status(value: str) -> bool:
    return (value or "").strip().upper() in {"FAILED", "FAILURE", "CANCELLED", "CANCELED", "DECLINED"}


def grant_parser_credits_once(payment_order: PaymentOrder) -> bool:
    """
    Grants parser credits once for a paid order.
    Returns True when credits were granted in this call, False when already granted.
    """
    with transaction.atomic():
        locked_order = PaymentOrder.objects.select_for_update().get(pk=payment_order.pk)
        if locked_order.credit_granted_at:
            return False
        if not locked_order.user_id:
            locked_order.status = "paid"
            locked_order.paid_at = locked_order.paid_at or timezone.now()
            locked_order.save(update_fields=["status", "paid_at", "updated_at"])
            return True

        entitlement, _ = UserEntitlement.objects.select_for_update().get_or_create(
            user=locked_order.user,
            defaults={
                "parser_credits": 0,
                "lifetime_purchased_credits": 0,
                "lifetime_consumed_credits": 0,
            },
        )
        entitlement.parser_credits += locked_order.credits
        entitlement.lifetime_purchased_credits += locked_order.credits
        entitlement.save(
            update_fields=[
                "parser_credits",
                "lifetime_purchased_credits",
                "updated_at",
            ]
        )

        now = timezone.now()
        locked_order.credit_granted_at = now
        locked_order.paid_at = locked_order.paid_at or now
        locked_order.status = "paid"
        locked_order.save(update_fields=["credit_granted_at", "paid_at", "status", "updated_at"])
        return True


def is_order_credit_eligible(payment_order: PaymentOrder) -> bool:
    if payment_order.credit_granted_at:
        return False
    if payment_order.status == "paid":
        return True
    return payment_order.transactions.filter(provider_status__in=["SUCCESS", "PAID", "COMPLETED", "CAPTURED"]).exists()
