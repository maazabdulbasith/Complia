import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("login", "routes/login.tsx"),
    route("terms-and-conditions", "routes/terms_and_conditions.tsx"),
    route("privacy-policy", "routes/privacy_policy.tsx"),
    route("refund-policy", "routes/refund_policy.tsx"),
    route("cancellation-policy", "routes/cancellation_policy.tsx"),
    route("superadmin", "routes/superadmin.tsx"),
    route("ca-help", "routes/ca_help.tsx"),
    route("saved", "routes/saved_notices.tsx"),
    route("notice/:id", "routes/notice_details.tsx"),
] satisfies RouteConfig;
