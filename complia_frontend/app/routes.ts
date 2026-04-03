import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("login", "routes/login.tsx"),
    route("terms-and-conditions", "routes/terms_and_conditions.tsx"),
    route("privacy-policy", "routes/privacy_policy.tsx"),
    route("contact-us", "routes/contact_us.tsx"),
    route("refund-policy", "routes/refund_policy.tsx"),
    route("cancellation-policy", "routes/cancellation_policy.tsx"),
    route("parser", "routes/parser.tsx"),
    route("superadmin", "routes/superadmin/layout.tsx", [
        index("routes/superadmin/overview.tsx"),
        route("payments", "routes/superadmin/payments.tsx"),
        route("assisted-intents", "routes/superadmin/assisted_intents.tsx"),
        route("notice-qa", "routes/superadmin/notice_qa.tsx"),
        route("parser-queue", "routes/superadmin/parser_queue.tsx"),
        route("ca-requests", "routes/superadmin/ca_requests.tsx"),
        route("feedback", "routes/superadmin/feedback.tsx"),
    ]),
    route("ca-help", "routes/ca_help.tsx"),
    route("saved", "routes/saved_notices.tsx"),
    route("notice/:id", "routes/notice_details.tsx"),
] satisfies RouteConfig;
